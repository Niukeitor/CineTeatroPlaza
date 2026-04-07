document.addEventListener('DOMContentLoaded', () => {
    const cartContainer = document.getElementById('cart-container');
    const cartSummary = document.getElementById('cart-summary');
    const payBtn = document.getElementById('btn-pay-all');
    const totalPriceEl = document.getElementById('cart-total-price');

    function renderCart() {
        const cart = getCart();
        cartContainer.innerHTML = '';

        if (cart.length === 0) {
            cartContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size: 1.2rem; margin-top: 50px;">Tu carrito está vacío.</p>';
            cartSummary.style.display = 'none';
            return;
        }

        let grantTotal = 0;

        cart.forEach(item => {
            const itemTotal = item.seats.length * item.price;
            grantTotal += itemTotal;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.movieTitle}</h4>
                    <p style="color:var(--text-secondary); font-size:0.9rem;">
                        ${item.seats.length} entrada(s) x $${item.price}
                    </p>
                    <div class="cart-seats-tags">
                        ${item.seats.map(s => `<span class="seat-tag">${s.region == 'left' ? 'Izq' : s.region == 'right' ? 'Der' : 'Cen'} - F${s.row+1} A${s.col+1}</span>`).join('')}
                    </div>
                </div>
                <div class="cart-item-actions">
                    <p class="cart-item-price">$${itemTotal}</p>
                    <button class="btn-remove" data-id="${item.movieId}">Eliminar</button>
                </div>
            `;
            cartContainer.appendChild(itemDiv);
        });

        totalPriceEl.innerText = grantTotal;
        cartSummary.style.display = 'flex';
        
        // Add remove handlers
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeFromCart(e.target.dataset.id);
                renderCart();
            });
        });
    }

    renderCart();

    payBtn.addEventListener('click', async () => {
        const cart = getCart();
        if (cart.length === 0) return;

        payBtn.disabled = true;
        payBtn.innerText = "Procesando el pago...";

        try {
            const token = localStorage.getItem('token');
            if(!token) {
                alert('¡Debes iniciar sesión con Google para finalizar la compra!');
                // Redirigir y guardar info (aquí simplificamos mandándolo al inicio)
                window.location.href = 'index.html';
                return;
            }

            const res = await fetch('/api/reserve-cart', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ cartItems: cart })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Hubo un problema procesando el pago. Intenta nuevamente.");
            }

            alert(`¡Pago exitoso!\nTodas tus entradas han sido reservadas. Puedes ir retirándolas en boletería mostrando tu documento.`);
            emptyCart();
            renderCart();
            payBtn.innerText = "Finalizar Compra / Pagar Todo";

        } catch(err) {
            alert(err.message);
            payBtn.disabled = false;
            payBtn.innerText = "Finalizar Compra / Pagar Todo";
        }
    });

});
