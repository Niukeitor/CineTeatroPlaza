const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

const GOOGLE_CLIENT_ID = '91767642995-21af6j0npll7f858ps31jp5d8k2iu2cm.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'cine_super_secreto_123';

// Middleware
app.use(cors());
app.use(express.json());
// Servir frontend
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexión a Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://cine_admin:cine_password@localhost:5432/cine_plaza'
});

// Auto-migración base de datos para nueva característica
pool.query("ALTER TABLE movies ADD COLUMN IF NOT EXISTS age_rating VARCHAR(50) DEFAULT 'ATP'")
    .catch(err => console.error("Auto-migración ignorada o fallida:", err));

// Auto-migración para tabla de ajustes
pool.query(`
    CREATE TABLE IF NOT EXISTS cinema_settings (
        id SERIAL PRIMARY KEY,
        config JSONB NOT NULL DEFAULT '{}'
    );
`).then(async () => {
    const res = await pool.query('SELECT COUNT(*) FROM cinema_settings');
    if (parseInt(res.rows[0].count) === 0) {
        const defaultSettings = {
            general_price: "$180",
            popular_price: "$130",
            schedule_weekdays: "17:00 a 21:00",
            schedule_weekends: "19:00 a 21:00",
            matinee_text: "Abrimos una hora antes de la primera función",
            manual_status: "auto"
        };
        await pool.query('INSERT INTO cinema_settings (id, config) VALUES (1, $1)', [defaultSettings]);
    }
}).catch(err => console.error("Error inicializando tabla cinema_settings:", err));


// Init seats func
async function ensureSeatsExist(movieId) {
    const check = await pool.query('SELECT COUNT(*) FROM seats WHERE movie_id = $1', [movieId]);
    if (parseInt(check.rows[0].count) === 0) {
        let values = [];
        // Layout: Left 8x3, Center 8x8, Right 8x3
        for(let r=0; r<8; r++) {
            for(let c=0; c<3; c++) values.push(`(${movieId}, 'left', ${r}, ${c}, false)`);
            for(let c=0; c<8; c++) values.push(`(${movieId}, 'center', ${r}, ${c}, false)`);
            for(let c=0; c<3; c++) values.push(`(${movieId}, 'right', ${r}, ${c}, false)`);
        }
        await pool.query(`INSERT INTO seats (movie_id, region, row_num, col_num, is_occupied) VALUES ${values.join(',')}`);
    }
}

// Middleware de Autenticación JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'Inicia sesión para realizar esta acción.' });

    jwt.verify(authHeader.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Sesión expirada o inválida' });
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Espacio exclusivo para administradores.' });
    }
};

// ==== RUTAS API ==== //

// Login con Google
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub, email, name, picture } = payload;

        let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user;

        if (userRes.rows.length === 0) {
            // El primero en loguearse será Admin automáticamente
            const countRes = await pool.query('SELECT COUNT(*) FROM users');
            const role = parseInt(countRes.rows[0].count) === 0 ? 'admin' : 'user';

            const insertRes = await pool.query(
                'INSERT INTO users (google_id, email, name, avatar_url, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [sub, email, name, picture, role]
            );
            user = insertRes.rows[0];
        } else {
            user = userRes.rows[0];
            // Fusión de cuenta (Por si se había registrado manual antes)
            await pool.query('UPDATE users SET google_id=$1, name=$2, avatar_url=$3 WHERE email=$4', [sub, name, picture, email]);
        }

        const jwtToken = jwt.sign(
            { id: user.id, google_id: user.google_id, email: user.email, role: user.role, name: user.name, avatar: user.avatar_url }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.json({ token: jwtToken, user });
    } catch (error) {
        console.error(error);
        res.status(401).json({ error: 'Token de Google rechazado' });
    }
});

// Registro Manual por Email y Password
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const checkRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (checkRes.rows.length > 0) return res.status(400).json({ error: 'El usuario ya está registrado' });

        const countRes = await pool.query('SELECT COUNT(*) FROM users');
        const role = parseInt(countRes.rows[0].count) === 0 ? 'admin' : 'user';

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';

        const insertRes = await pool.query(
            'INSERT INTO users (email, password_hash, name, role, avatar_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [email, hash, name, role, avatar]
        );
        const user = insertRes.rows[0];

        const jwtToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name, avatar: user.avatar_url }, 
            JWT_SECRET, { expiresIn: '24h' }
        );
        
        res.json({ token: jwtToken, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login Manual por Email y Password
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) return res.status(400).json({ error: 'Credenciales inválidas' });

        const user = userRes.rows[0];
        if (!user.password_hash) return res.status(400).json({ error: 'Este correo está vinculado a Google. Entra usando el botón de Google.' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Credenciales inválidas' });

        const jwtToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name, avatar: user.avatar_url }, 
            JWT_SECRET, { expiresIn: '24h' }
        );
        res.json({ token: jwtToken, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Obtener configuraciones
app.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT config FROM cinema_settings WHERE id = 1');
        if(result.rows.length > 0) res.json(result.rows[0].config);
        else res.json({});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Guardar configuraciones (Admin)
app.put('/api/settings', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE cinema_settings SET config = $1 WHERE id = 1 RETURNING *',
            [req.body]
        );
        res.json(result.rows[0].config);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Obtener cartelera
app.get('/api/movies', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM movies ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Buscar peliculas a través del proxy TMDB (Admin)
app.get('/api/search', async (req, res) => {
    try {
        const query = encodeURIComponent(req.query.q);
        const apiKey = '13e7402df263da2d6dde459b7692746a';
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=es-ES&query=${query}`;
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data.results || []);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// Crear pelicula desde TMDB ID (Admin)
app.post('/api/movies', verifyToken, isAdmin, async (req, res) => {
    const { tmdbId, price } = req.body;
    let title = "Película Desconocida", genre = "Varios";
    let poster_url = 'assets/poster_scifi.png';
    let backdrop_url = null;
    let age_rating = 'ATP';
    
    try {
        const apiKey = '13e7402df263da2d6dde459b7692746a';
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=es-ES`;
        const response = await fetch(url);
        const fullData = await response.json();
        
        if (fullData && fullData.id) {
            title = fullData.title || fullData.original_title;
            
            // Procesamos géneros si existen (ej. "Acción, Ciencia Ficción")
            if (fullData.genres && fullData.genres.length > 0) {
                genre = fullData.genres.map(g => g.name).join(', ');
            }

            // Imágenes 4k con ruta final TMDB
            const baseImageUrl = "https://image.tmdb.org/t/p/original";
            if (fullData.poster_path) poster_url = baseImageUrl + fullData.poster_path;
            if (fullData.backdrop_path) backdrop_url = baseImageUrl + fullData.backdrop_path;
            
            // Intentar traer clasificación de edad
            try {
                const releaseDatesUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${apiKey}`;
                const rdResponse = await fetch(releaseDatesUrl);
                const rdData = await rdResponse.json();
                
                if (rdData && rdData.results) {
                    const usRelease = rdData.results.find(r => r.iso_3166_1 === 'US');
                    const esRelease = rdData.results.find(r => r.iso_3166_1 === 'ES');
                    const certInfo = esRelease || usRelease || rdData.results[0];
                    
                    if (certInfo && certInfo.release_dates) {
                        const certification = certInfo.release_dates.find(d => d.certification && d.certification !== '')?.certification;
                        if (certification) {
                            const c = certification.toLowerCase();
                            if(c.includes('g') || c === 'tp' || c === 'a' || c === 'atp' || c === 'pg') age_rating = 'ATP';
                            else if(c.includes('pg-13') || c === '12' || c === '13' || c === '14') age_rating = '+13';
                            else if(c.includes('r') || c === '16' || c === '18' || c.includes('nc')) age_rating = 'Solo +18';
                            else age_rating = certification; // fallback
                        }
                    }
                }
            } catch (certError) {
                console.error("Error trayendo clasificación de edad TMDB:", certError);
            }
        }
    } catch (e) {
        console.error("Error contactando TMDB:", e);
    }

    try {
        const result = await pool.query(
            'INSERT INTO movies (title, genre, price, age_rating, poster_url, backdrop_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, genre, price, age_rating, poster_url, backdrop_url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Crear pelicula manualmente con imagen local
app.post('/api/movies/manual', verifyToken, isAdmin, upload.fields([{name: 'poster'}, {name: 'backdrop'}]), async (req, res) => {
    const { title, genre, price, age_rating } = req.body;
    let poster_url = req.files['poster'] ? '/uploads/' + req.files['poster'][0].filename : 'assets/poster_scifi.png';
    let backdrop_url = req.files['backdrop'] ? '/uploads/' + req.files['backdrop'][0].filename : null;
    
    try {
        const result = await pool.query(
            'INSERT INTO movies (title, genre, price, age_rating, poster_url, backdrop_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title || 'Película Manual', genre || 'Independiente', price || 180, age_rating || 'ATP', poster_url, backdrop_url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Eliminar pelicula (Admin)
app.delete('/api/movies/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM movies WHERE id = $1', [req.params.id]);
        res.json({success: true});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Bulk Eliminar peliculas (Admin)
app.post('/api/movies/bulk-delete', verifyToken, isAdmin, async (req, res) => {
    const { ids } = req.body;
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({error: "No se enviaron IDs válidos"});
        }
        await pool.query('DELETE FROM movies WHERE id = ANY($1::int[])', [ids]);
        res.json({success: true});
    } catch (err) {
        console.error("Bulk Delete Error:", err);
        res.status(500).json({error: err.message});
    }
});

// Editar pelicula (Admin)
app.put('/api/movies/:id', verifyToken, isAdmin, async (req, res) => {
    const { title, price, age_rating } = req.body;
    try {
        const result = await pool.query(
            'UPDATE movies SET title = $1, price = $2, age_rating = $3 WHERE id = $4 RETURNING *',
            [title, price, age_rating, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Resetear sala (Admin)
app.post('/api/movies/:id/reset', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE seats SET is_occupied = false WHERE movie_id = $1', [req.params.id]);
        res.json({success: true});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Resetear TODAS las salas (Admin)
app.post('/api/movies/reset-all', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE seats SET is_occupied = false');
        res.json({success: true});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Obtener asientos de una peli
app.get('/api/seats/:movieId', async (req, res) => {
    const { movieId } = req.params;
    try {
        await ensureSeatsExist(movieId);
        const result = await pool.query('SELECT * FROM seats WHERE movie_id = $1', [movieId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Reservar asientos (individual, legado)
app.post('/api/reserve', verifyToken, async (req, res) => {
    const { movieId, seats } = req.body;
    try {
        await pool.query('BEGIN');
        for (let s of seats) {
            await pool.query(
                'UPDATE seats SET is_occupied = true WHERE movie_id = $1 AND region = $2 AND row_num = $3 AND col_num = $4',
                [movieId, s.region, s.row, s.col]
            );
        }
        await pool.query('COMMIT');
        res.json({success: true});
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({error: err.message});
    }
});

// Reservar carrito entero con validación de concurrencia
app.post('/api/reserve-cart', verifyToken, async (req, res) => {
    const { cartItems } = req.body;
    // cartItems: [{movieId: 1, movieTitle: "...", seats: [{region, row, col}, ...]}, ...]
    try {
        await pool.query('BEGIN');
        for (let item of cartItems) {
            for (let s of item.seats) {
                // Verificar si el asiento ya está ocupado (con bloqueo FOR UPDATE)
                const checkRes = await pool.query(
                    'SELECT is_occupied FROM seats WHERE movie_id = $1 AND region = $2 AND row_num = $3 AND col_num = $4 FOR UPDATE',
                    [item.movieId, s.region, s.row, s.col]
                );
                
                if (checkRes.rows.length === 0 || checkRes.rows[0].is_occupied) {
                    throw new Error(`Lo sentimos, uno o más asientos para "${item.movieTitle}" acaban de ser ocupados. Por favor, elimina el pedido y vuelve a elegir.`);
                }
                
                await pool.query(
                    'UPDATE seats SET is_occupied = true WHERE movie_id = $1 AND region = $2 AND row_num = $3 AND col_num = $4',
                    [item.movieId, s.region, s.row, s.col]
                );
            }
        }
        await pool.query('COMMIT');
        res.json({success: true});
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(400).json({error: err.message});
    }
});


app.listen(port, () => {
  console.log(`Cine Backend running on http://localhost:${port}`);
});
