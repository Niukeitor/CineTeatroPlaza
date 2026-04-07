// utilidades para el carrito de compras

// ==== Compatibilidad y limpieza ====
// Borramos el viejo carro compartido global si es que queda rastros de el
if (localStorage.getItem('cine_cart')) {
    localStorage.removeItem('cine_cart');
}

function getCartKey() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (user && user.id) return `cine_cart_user_${user.id}`;
        } catch(e){}
    }
    return 'cine_cart_guest';
}

function getCart() {
    const cart = localStorage.getItem(getCartKey());
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem(getCartKey(), JSON.stringify(cart));
    updateCartCount();
}

function addToCart(movieId, movieTitle, price, seats) {
    let cart = getCart();
    
    let existingItem = cart.find(item => String(item.movieId) === String(movieId));
    
    if (existingItem) {
        // Agregar asientos nuevos a los existentes (evitando posibles duplicados)
        seats.forEach(newSeat => {
            const exists = existingItem.seats.some(s => s.region === newSeat.region && s.row === newSeat.row && s.col === newSeat.col);
            if (!exists) {
                existingItem.seats.push(newSeat);
            }
        });
        existingItem.price = price; // sync price
    } else {
        cart.push({
            movieId: String(movieId),
            movieTitle,
            price,
            seats,
            timestamp: new Date().getTime()
        });
    }
    
    saveCart(cart);
}

function removeFromCart(movieId) {
    let cart = getCart();
    cart = cart.filter(item => String(item.movieId) !== String(movieId));
    saveCart(cart);
}

function emptyCart() {
    localStorage.removeItem(getCartKey());
    updateCartCount();
}

function getCartTotalCount() {
    return getCart().reduce((acc, item) => acc + item.seats.length, 0);
}

function updateCartCount() {
    const count = getCartTotalCount();
    
    // Update navbar badge if exists
    const navBadge = document.getElementById('nav-cart-count');
    if (navBadge) {
        navBadge.innerText = count;
        // Animacion pálpito ligera si crece
        navBadge.classList.add('pulse-anim');
        setTimeout(() => navBadge.classList.remove('pulse-anim'), 300);
    }
    
    // Update floating badge if exists
    const floatingBadge = document.getElementById('floating-cart-count');
    if (floatingBadge) {
        floatingBadge.innerText = count;
        if(count > 0) {
            document.getElementById('floating-cart').classList.add('visible');
        } else {
            document.getElementById('floating-cart').classList.remove('visible');
        }
    }
}

// Inject floating cart button when loaded
document.addEventListener('DOMContentLoaded', () => {
    const excludePages = ['admin.html', 'auth.html', 'cart.html'];
    const currentPath = window.location.pathname.toLowerCase();
    
    // Only exclude pages if running from server, but also check for typical endings
    const isExcluded = excludePages.some(page => currentPath.endsWith(page));

    if (!isExcluded) {
        if (!document.getElementById('floating-cart')) {
            const floatingCart = document.createElement('a');
            floatingCart.href = 'cart.html';
            floatingCart.id = 'floating-cart';
            floatingCart.className = 'floating-cart-btn';
            
            floatingCart.innerHTML = `
                <div class="cart-icon-container">
                    <span>🛒</span>
                    <span id="floating-cart-count" class="cart-badge">0</span>
                </div>
            `;
            
            document.body.appendChild(floatingCart);
        }
    }
    
    updateCartCount();
});
