// === Manejo de Identidad Visual ===

function renderUserProfile(user) {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${user.avatar_url}" style="width:36px; height:36px; border-radius:50%; border: 2px solid var(--accent-color);">
                <strong style="color:white; font-size: 14px;">${user.name}</strong>
                <button onclick="logout()" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-weight:bold;">Salir</button>
            </div>
        `;
    }
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink && user.role === 'admin') {
        adminLink.style.display = 'block';
    }
}

window.logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
};

function checkLogin() {
    const userStr = localStorage.getItem('user');
    if (userStr) renderUserProfile(JSON.parse(userStr));
}

// === Lógica Principal ===
document.addEventListener('DOMContentLoaded', async () => {
    checkLogin();
    let globalSettings = {};

    async function loadPublicSettings() {
        try {
            const res = await fetch('/api/settings');
            globalSettings = await res.json();
            if (globalSettings.general_price) document.getElementById('pub-general-price').innerText = globalSettings.general_price;
            if (globalSettings.popular_price) document.getElementById('pub-popular-price').innerText = globalSettings.popular_price;
            if (globalSettings.schedule_weekdays) document.getElementById('pub-weekdays').innerText = globalSettings.schedule_weekdays;
            if (globalSettings.schedule_weekends) document.getElementById('pub-weekends').innerText = globalSettings.schedule_weekends;
            if (globalSettings.matinee_text) document.getElementById('pub-matinee').innerText = globalSettings.matinee_text;
            
            const closureContainer = document.getElementById('pub-closure-container');
            const closureNotice = document.getElementById('pub-closure-notice');
            if (globalSettings.closure_notice && globalSettings.closure_notice.trim() !== '') {
                closureNotice.innerText = globalSettings.closure_notice;
                closureContainer.style.display = 'block';
            } else {
                if(closureContainer) closureContainer.style.display = 'none';
            }

            updateScheduleStatus();
        } catch (e) { console.error('Error loading config:', e); }
    }

    loadPublicSettings();
    
    // Interval update for schedule every minute
    setInterval(updateScheduleStatus, 60000);

    const moviesContainer = document.getElementById('movies-container');

    function updateScheduleStatus() {
        const statusDiv = document.getElementById('dynamic-horario-status');
        if (!statusDiv) return;

        let isOpen = false;
        let forceStatus = globalSettings.manual_status || 'auto';

        if (forceStatus === 'open') {
            isOpen = true;
        } else if (forceStatus === 'closed') {
            isOpen = false;
        } else {
            const now = new Date();
            const day = now.getDay();
            const hour = now.getHours();
            
            if (day === 1 || day === 5) {
                if (hour >= 16 && hour < 21) isOpen = true;
            } else if (day === 0 || day === 6) {
                if (hour >= 18 && hour < 21) isOpen = true;
            }
        }
        
        if (isOpen) {
            statusDiv.className = 'horario-status open';
            statusDiv.style.color = 'var(--seat-available)';
            statusDiv.style.background = 'rgba(34, 197, 94, 0.1)';
            statusDiv.innerHTML = '<span class="pulse"></span> Abierto Ahora';
        } else {
            statusDiv.className = 'horario-status closed';
            statusDiv.style.color = '#ef4444'; // Rojo para cerrado
            statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            statusDiv.innerHTML = '<span style="display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%; margin-right:10px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);"></span> Cerrado Actualmente';
        }
    }

    try {
        const response = await fetch('/api/movies');
        const movies = await response.json();

        moviesContainer.innerHTML = ''; // Clear loading message

        if(movies.length === 0) {
            moviesContainer.innerHTML = '<p style="text-align:center;">No hay películas en cartelera actualmente.</p>';
            return;
        }

        // --- SISTEMA DEL HERO SLIDER DINÁMICO ---
        const heroContainer = document.getElementById('hero-slides-container');
        const indicatorsContainer = document.getElementById('slider-indicators');
        
        if (heroContainer && movies.length > 0) {
            heroContainer.innerHTML = '';
            indicatorsContainer.innerHTML = '';
            
            const trendingMovies = movies.slice(0, 5); // Tomamos de las primeras 5
            
            trendingMovies.forEach((movie, index) => {
                const slide = document.createElement('div');
                slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;
                
                // Si la película no tiene un fondo 16:9 4k (por ser antigua de omdb), usamos su viejo poster
                slide.style.backgroundImage = `url('${movie.backdrop_url || movie.poster_url}')`;
                
                slide.innerHTML = `
                    <div class="hero-slide-content">
                        <h2>${movie.title}</h2>
                        <button class="btn-primary" style="margin-right: 15px;" onclick="reserveMovie(${movie.id}, '${encodeURIComponent(movie.title)}', ${movie.price})">Reservar Ticket</button>
                        <button class="btn-secondary" style="border: 1px solid #94a3b8; color: white; width:auto; border-radius:4px; padding:12px 20px; margin-top:0;" onclick="window.location.href='#cartelera'">Detalles</button>
                        <div class="hero-tags">
                            <span class="tag-box">${movie.age_rating || 'ATP'}</span>
                            <span>Aclamada por la crítica</span>
                            <span>${movie.genre}</span>
                        </div>
                    </div>
                `;
                heroContainer.appendChild(slide);

                const dot = document.createElement('div');
                dot.className = `indicator ${index === 0 ? 'active' : ''}`;
                dot.addEventListener('click', () => switchSlide(index));
                indicatorsContainer.appendChild(dot);
            });

            // Lógica rotativa
            let currentIndex = 0;
            const slideCount = trendingMovies.length;
            let slideInterval = setInterval(nextSlide, 4500);

            function nextSlide() {
                switchSlide((currentIndex + 1) % slideCount);
            }

            window.switchSlide = function(index) {
                const slides = document.querySelectorAll('.hero-slide');
                const dots = document.querySelectorAll('.indicator');
                
                if(!slides.length || !dots.length) return;

                slides[currentIndex].classList.remove('active');
                dots[currentIndex].classList.remove('active');
                
                currentIndex = index;
                
                slides[currentIndex].classList.add('active');
                dots[currentIndex].classList.add('active');
                
                clearInterval(slideInterval);
                slideInterval = setInterval(nextSlide, 4500);
            }
        }
        // --- FIN SLIDER ---

        movies.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.innerHTML = `
                <div class="poster-wrapper">
                    <img src="${movie.poster_url}" alt="Póster ${movie.title}" onerror="this.src='https://via.placeholder.com/400x600?text=Sin+Poster'">
                </div>
                <div class="movie-info">
                    <h3>${movie.title}</h3>
                    <p>${movie.genre} | <strong style="color:var(--accent-color)">${movie.age_rating || 'ATP'}</strong></p>
                    <p class="movie-price">$${movie.price}</p>
                    <button class="btn-secondary select-movie-btn" onclick="reserveMovie(${movie.id}, '${encodeURIComponent(movie.title)}', ${movie.price})">Reservar Asientos</button>
                </div>
            `;
            moviesContainer.appendChild(card);
        });

    } catch (error) {
        moviesContainer.innerHTML = '<p style="text-align: center; color: red;">Error conectando con el servidor de base de datos.</p>';
        console.error(error);
    }
});

function reserveMovie(id, title, price) {
    window.location.href = `reserva.html?id=${id}&movie=${title}&price=${price}`;
}
