function toggleView(view) {
    if (view === 'register') {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-view').style.display = 'block';
    } else {
        document.getElementById('register-view').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
    }
}

function processAuthResponse(data) {
    if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Migrar carrito de invitado al usuario
        const guestCart = localStorage.getItem('cine_cart_guest');
        if (guestCart) {
            const userCartKey = `cine_cart_user_${data.user.id}`;
            const existingCart = localStorage.getItem(userCartKey) ? JSON.parse(localStorage.getItem(userCartKey)) : [];
            
            if (existingCart.length === 0) {
                // Si el usuario no tenía un carrito previo guardado, asignarle directo el de invitado
                localStorage.setItem(userCartKey, guestCart);
            }
            // Borrar el carrito de invitado para que no quede huerfano ni lo vea el siguiente que desloguee
            localStorage.removeItem('cine_cart_guest');
        }

        if (data.user.role === 'admin') alert('¡Reconocido como administrador supremo del Cine!');
        window.location.href = 'index.html'; // Devolver a la página principal
    } else {
        alert(data.error || 'Autenticación fallida');
    }
}

// Handler de Google
window.handleCredentialResponse = async (response) => {
    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: response.credential })
        });
        const data = await res.json();
        processAuthResponse(data);
    } catch (e) {
        console.error(e);
        alert("Error de conexión con Google");
    }
};

// Handler de Login Manual
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value
            })
        });
        const data = await res.json();
        processAuthResponse(data);
    } catch (e) {
        alert("El servidor no responde");
    } finally {
        btn.innerText = "Acceder";
        btn.disabled = false;
    }
});

// Handler de Registro Manual
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Creando...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value
            })
        });
        const data = await res.json();
        if(res.status !== 200) {
            alert(data.error);
        } else {
            processAuthResponse(data);
        }
    } catch (e) {
        alert("El servidor no responde");
    } finally {
        btn.innerText = "Registrarse";
        btn.disabled = false;
    }
});
