function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        movie: decodeURIComponent(params.get('movie')),
        price: parseInt(params.get('price')) || 0
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    const { id: movieId, movie, price } = getQueryParams();

    if (!movieId) {
        alert("Petición inválida. Volviendo al inicio.");
        window.location.href = "index.html";
        return;
    }

    document.getElementById('pelicula-titulo').innerText = movie;
    
    const blockLeft = document.getElementById('block-left');
    const blockCenter = document.getElementById('block-center');
    const blockRight = document.getElementById('block-right');
    const countElement = document.getElementById('count');
    const totalElement = document.getElementById('total');
    const confirmBtn = document.getElementById('btn-confirmar');

    let selectedSeatsCount = 0;
    let localSelectedSeats = []; // {region, row, col}

    try {
        const response = await fetch(`/api/seats/${movieId}`);
        const dbSeats = await response.json();
        
        // Estructurar array visual: { left: [...], center: [...], right: [...] }
        const layoutConfig = {
            left: { rows: 8, cols: 3 },
            center: { rows: 8, cols: 8 },
            right: { rows: 8, cols: 3 }
        };

        const cineVirtual = {
            left: Array(8).fill(0).map(()=>Array(3).fill(false)),
            center: Array(8).fill(0).map(()=>Array(8).fill(false)),
            right: Array(8).fill(0).map(()=>Array(3).fill(false))
        };

        // Rellenar desde DB
        dbSeats.forEach(s => {
            cineVirtual[s.region][s.row_num][s.col_num] = s.is_occupied;
        });

        renderBlock(blockLeft, cineVirtual.left, 'left');
        renderBlock(blockCenter, cineVirtual.center, 'center');
        renderBlock(blockRight, cineVirtual.right, 'right');

    } catch (err) {
        alert("Error cargando la sala central.");
        console.error(err);
    }

    function renderBlock(container, regionData, regionName) {
        container.innerHTML = '';
        regionData.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('seat-row-top');

            row.forEach((isOccupied, colIndex) => {
                const seat = document.createElement('div');
                seat.classList.add('seat-top');
                seat.dataset.row = rowIndex;
                seat.dataset.col = colIndex;
                seat.dataset.region = regionName;

                if (isOccupied) seat.classList.add('occupied');
                else seat.classList.add('available');

                seat.addEventListener('click', handleSeatClick);
                rowDiv.appendChild(seat);
            });
            container.appendChild(rowDiv);
        });
    }

    function handleSeatClick(e) {
        const seat = e.target;
        if (seat.classList.contains('occupied')) return;
        
        const seatData = {
            region: seat.dataset.region,
            row: parseInt(seat.dataset.row),
            col: parseInt(seat.dataset.col)
        };

        if (seat.classList.contains('selected')) {
            seat.classList.remove('selected');
            seat.classList.add('available');
            selectedSeatsCount--;
            localSelectedSeats = localSelectedSeats.filter(s => !(s.region === seatData.region && s.row === seatData.row && s.col === seatData.col));
        } else {
            seat.classList.remove('available');
            seat.classList.add('selected');
            selectedSeatsCount++;
            localSelectedSeats.push(seatData);
        }
        updateCheckoutPanel();
    }

    function updateCheckoutPanel() {
        countElement.innerText = selectedSeatsCount;
        totalElement.innerText = selectedSeatsCount * price;
        confirmBtn.disabled = selectedSeatsCount === 0;
        confirmBtn.innerText = selectedSeatsCount === 0 ? "Selecciona Asientos" : "Añadir al Carrito";
    }

    // Add to Local Cart
    confirmBtn.addEventListener('click', () => {
        if (selectedSeatsCount === 0) return;
        
        // Verifica si el precio existe, sino usa 0. addToCart es de cart-utils.js
        addToCart(movieId, movie, price, localSelectedSeats);
        
        // Marcar visualmente de inmediato como si estuvieran reservados en esta pantalla 
        document.querySelectorAll('.seat-top.selected').forEach(s => {
            s.classList.remove('selected');
            s.classList.add('occupied');
        });

        alert(`¡Selección guardada!\n${selectedSeatsCount} asiento(s) para ${movie} añadidos al carrito.`);
        
        selectedSeatsCount = 0;
        localSelectedSeats = [];
        updateCheckoutPanel();
    });

});
