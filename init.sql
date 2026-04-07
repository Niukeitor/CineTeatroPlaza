CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    genre VARCHAR(100),
    price INTEGER NOT NULL,
    age_rating VARCHAR(50) DEFAULT 'ATP',
    poster_url VARCHAR(255),
    backdrop_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS seats (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    region VARCHAR(50) NOT NULL,
    row_num INTEGER NOT NULL,
    col_num INTEGER NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    UNIQUE(movie_id, region, row_num, col_num)
);

-- Inserción de datos iniciales
INSERT INTO movies (title, genre, price, age_rating, poster_url) VALUES 
('Dune', 'Ciencia Ficción', 5000, '+13', 'assets/poster_scifi.png'),
('Forest Tails', 'Familiar / Animación', 4500, 'ATP', 'assets/poster_animated.png'),
('Nightfall', 'Acción / Superhéroes', 5500, '+13', 'assets/poster_superhero.png'),
('The Silence', 'Terror / Suspenso', 4000, '+16', 'assets/poster_horror.png')
ON CONFLICT (title) DO NOTHING;

