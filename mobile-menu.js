document.addEventListener('DOMContentLoaded', () => {
    // Buscar si existe el toggle de móvil
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.desktop-nav');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('mobile-nav-active');
            
            // Animación del botón (cambia de hamburguesa a crucecita o viceversa)
            if (navMenu.classList.contains('mobile-nav-active')) {
                menuToggle.innerHTML = '✖';
                menuToggle.style.color = 'var(--accent-color)';
            } else {
                menuToggle.innerHTML = '☰';
                menuToggle.style.color = 'var(--text-primary)';
            }
        });

        // Ocultar menú al hacer clic en un enlace interno
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('mobile-nav-active');
                menuToggle.innerHTML = '☰';
                menuToggle.style.color = 'var(--text-primary)';
            });
        });
    }
});
