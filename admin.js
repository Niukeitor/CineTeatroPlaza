const userStr = localStorage.getItem('user');
const token = localStorage.getItem('token');
let user = null;

if(userStr) user = JSON.parse(userStr);

if(!token || !user || user.role !== 'admin') {
    document.body.innerHTML = `
       <div style="display:flex; height:100vh; flex-direction:column; align-items:center; justify-content:center; background:#0f1523; color:white; font-family:'Outfit', sans-serif;">
            <h1 style="color:red; margin-bottom:20px; font-size:40px;">⛔ Acceso Restringido</h1>
            <p style="margin-bottom:30px; font-size:18px;">Debes autenticarte con tu cuenta en la Cartelera primero para entrar al sistema admin.</p>
            <a href="index.html" class="btn-primary" style="text-decoration:none;">Ir al Inicio</a>
       </div>
    `;
    throw new Error('Acceso denegado');
}

// Cabeceras globales para peticiones Admin
const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-movie-form');
    const searchResults = document.getElementById('search-results');
    const tbody = document.querySelector('#movies-table tbody');
    const priceModal = document.getElementById('price-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalTitle = document.getElementById('modal-movie-title');
    const modalPrice = document.getElementById('modal-price');

    let selectedImdbId = null;

    let selectedMovies = new Set();
    const selectAllCheckbox = document.getElementById('select-all-movies');
    const btnBulkDelete = document.getElementById('btn-bulk-delete');

    function updateBulkDeleteButton() {
        if(selectedMovies.size > 0) {
            btnBulkDelete.style.display = 'block';
            btnBulkDelete.innerText = `🗑️ Eliminar Seleccionadas (${selectedMovies.size})`;
        } else {
            btnBulkDelete.style.display = 'none';
        }
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.movie-checkbox');
            if(e.target.checked) {
                checkboxes.forEach(cb => {
                    cb.checked = true;
                    selectedMovies.add(parseInt(cb.value));
                });
            } else {
                checkboxes.forEach(cb => cb.checked = false);
                selectedMovies.clear();
            }
            updateBulkDeleteButton();
        });
    }

    window.toggleMovieSelection = (id, checked) => {
        if(checked) selectedMovies.add(id);
        else selectedMovies.delete(id);
        
        const checkboxes = document.querySelectorAll('.movie-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = (selectedMovies.size > 0 && selectedMovies.size === checkboxes.length);
        }
        updateBulkDeleteButton();
    };

    // Cargar movies
    async function loadMovies() {
        const res = await fetch('/api/movies');
        const movies = await res.json();
        
        tbody.innerHTML = '';
        selectedMovies.clear();
        updateBulkDeleteButton();
        if (selectAllCheckbox) selectAllCheckbox.checked = false;

        movies.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="movie-checkbox" value="${m.id}" onchange="toggleMovieSelection(${m.id}, this.checked)" style="width: 18px; height: 18px; cursor: pointer;"></td>
                <td>${m.id}</td>
                <td>
                    <strong>${m.title}</strong><br>
                    <small style="color:var(--text-secondary)">${m.genre}</small><br>
                    <small style="color:var(--accent-color); font-weight:bold;">${m.age_rating || 'ATP'}</small>
                </td>
                <td>$${m.price}</td>
                <td style="display:flex; gap:10px;">
                    <button class="btn-primary" onclick="openEditModal(${m.id}, '${m.title.replace(/'/g, "\\'")}', ${m.price}, '${m.age_rating || 'ATP'}')" style="background:#3b82f6; padding:8px 15px; margin:0; border:none; border-radius:5px; font-size:14px;">Editar</button>
                    <button class="btn-warning" onclick="resetRoom(${m.id})">Limpiar Sala</button>
                    <button class="btn-danger" onclick="deleteMovie(${m.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Buscar películas
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('omdb-search-input').value;
        searchResults.innerHTML = '<p style="color:var(--accent-color)">Buscando en la bóveda...</p>';

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await res.json();

            searchResults.innerHTML = '';

            if(results.length === 0) {
                searchResults.innerHTML = '<p>No se encontraron películas con ese nombre.</p>';
                return;
            }

            results.forEach(movie => {
                const div = document.createElement('div');
                div.style.cssText = "background: var(--card-bg); border-radius: 8px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s;";
                
                const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : 'assets/poster_scifi.png';
                const releaseYear = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';

                div.innerHTML = `
                    <div style="height: 200px; width: 100%; background: #000;">
                        <img src="${posterUrl}" style="width:100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="padding: 10px; font-size: 14px; text-align: center;">
                        <strong>${movie.title}</strong>
                        <div style="color: var(--text-secondary); margin-top:5px;">${releaseYear}</div>
                    </div>
                `;
                div.addEventListener('mouseover', () => div.style.transform = 'scale(1.05)');
                div.addEventListener('mouseout', () => div.style.transform = 'scale(1)');
                
                div.addEventListener('click', () => {
                    selectedImdbId = movie.id;
                    modalTitle.innerText = movie.title;
                    priceModal.style.display = 'flex';
                });

                searchResults.appendChild(div);
            });
        } catch (err) {
            searchResults.innerHTML = '<p style="color:red">Error de conexión al servidor.</p>';
        }
    });

    // Cerrar Modal
    modalCancel.addEventListener('click', () => {
        priceModal.style.display = 'none';
        selectedImdbId = null;
    });

    // Confirmar y agregar
    modalConfirm.addEventListener('click', async () => {
        if (!selectedImdbId) return;
        const price = parseInt(modalPrice.value) || 0;
        
        modalConfirm.disabled = true;
        modalConfirm.innerText = "Sincronizando Mágia...";

        try {
            await fetch('/api/movies', {
                method: 'POST',
                headers: adminHeaders,
                body: JSON.stringify({ tmdbId: selectedImdbId, price })
            });

            priceModal.style.display = 'none';
            searchForm.reset();
            searchResults.innerHTML = '';
            loadMovies();
        } catch (e) {
            alert('Error al importar película desde el servidor maestro.');
        } finally {
            modalConfirm.disabled = false;
            modalConfirm.innerText = "Agregar al Cine";
            selectedImdbId = null;
        }
    });

    // Edit Modal Logic
    const editModal = document.getElementById('edit-modal');
    const editCancel = document.getElementById('edit-modal-cancel');
    const editConfirm = document.getElementById('edit-modal-confirm');

    window.openEditModal = (id, title, price, age) => {
        document.getElementById('edit-movie-id').value = id;
        document.getElementById('edit-movie-title').value = title;
        document.getElementById('edit-movie-price').value = price;
        document.getElementById('edit-movie-age').value = age;
        editModal.style.display = 'flex';
    };

    editCancel.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    editConfirm.addEventListener('click', async () => {
        const id = document.getElementById('edit-movie-id').value;
        const title = document.getElementById('edit-movie-title').value;
        const price = parseInt(document.getElementById('edit-movie-price').value) || 0;
        const age_rating = document.getElementById('edit-movie-age').value || 'ATP';

        editConfirm.disabled = true;
        editConfirm.innerText = "Guardando...";

        try {
            const response = await fetch(`/api/movies/${id}`, {
                method: 'PUT',
                headers: adminHeaders,
                body: JSON.stringify({ title, price, age_rating })
            });
            
            if(!response.ok) {
                const data = await response.json();
                alert('Error al guardar: ' + data.error);
                return;
            }

            editModal.style.display = 'none';
            loadMovies();
        } catch (e) {
            alert('Error de conexión al intentar actualizar la película.');
        } finally {
            editConfirm.disabled = false;
            editConfirm.innerText = "Guardar Cambios";
        }
    });

    window.bulkDeleteMovies = async () => {
        if(selectedMovies.size === 0) return;
        if(confirm(`⚠️ ALERTA: ¿Estás MUY SEGURO de que deseas eliminar ${selectedMovies.size} películas permanentemente de la cartelera?`)) {
            const originalText = btnBulkDelete.innerText;
            btnBulkDelete.disabled = true;
            btnBulkDelete.innerText = "Borrando...";

            try {
                const response = await fetch('/api/movies/bulk-delete', {
                    method: 'POST',
                    headers: adminHeaders,
                    body: JSON.stringify({ ids: Array.from(selectedMovies) })
                });
                
                if(!response.ok) {
                    const data = await response.json();
                    alert('Error en servidor al borrar: ' + data.error);
                } else {
                    alert(`${selectedMovies.size} películas eliminadas con éxito.`);
                    loadMovies();
                }
            } catch (e) {
                alert('Error de conexión intentando borrar masivamente.');
            } finally {
                btnBulkDelete.disabled = false;
                btnBulkDelete.innerText = originalText;
            }
        }
    };

    // Funciones globales
    window.deleteMovie = async (id) => {
        if(confirm("¿Segurísimo de eliminar esta película de forma permanente?")) {
            await fetch(`/api/movies/${id}`, { method: 'DELETE', headers: adminHeaders });
            loadMovies();
        }
    };

    window.resetRoom = async (id) => {
        if(confirm("Esto borrará TODAS las reservas de esta sala y liberará los asientos. ¿Proceder?")) {
            await fetch(`/api/movies/${id}/reset`, { method: 'POST', headers: adminHeaders });
            alert("Sala Reiniciada. Asientos libres vacíos de nuevo.");
        }
    };

    window.resetAllRooms = async () => {
        if(confirm("⚠️ PELIGRO TOTAL: ¿Estás MUY SEGURO de querer borrar las reservas de TODAS LAS PELÍCULAS en cartelera al mismo tiempo? Esta acción no se puede deshacer.")) {
            try {
                await fetch('/api/movies/reset-all', { method: 'POST', headers: adminHeaders });
                alert("Operación masiva completada. Todas las salas de todo el cine están vacías nuevamente.");
            } catch(e) {
                alert("Ocurrió un error tratando de reiniciar todo.");
            }
        }
    };

    // Cargar configuraciones generales
    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data && Object.keys(data).length > 0) {
                document.getElementById('cfg-general-price').value = data.general_price || '';
                document.getElementById('cfg-popular-price').value = data.popular_price || '';
                document.getElementById('cfg-weekdays').value = data.schedule_weekdays || '';
                document.getElementById('cfg-weekends').value = data.schedule_weekends || '';
                document.getElementById('cfg-matinee').value = data.matinee_text || '';
                document.getElementById('cfg-closure-notice').value = data.closure_notice || '';
                document.getElementById('cfg-status').value = data.manual_status || 'auto';
            }
        } catch (e) {
            console.error("No se pudo cargar la configuración:", e);
        }
    }

    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const config = {
                general_price: document.getElementById('cfg-general-price').value,
                popular_price: document.getElementById('cfg-popular-price').value,
                schedule_weekdays: document.getElementById('cfg-weekdays').value,
                schedule_weekends: document.getElementById('cfg-weekends').value,
                matinee_text: document.getElementById('cfg-matinee').value,
                closure_notice: document.getElementById('cfg-closure-notice').value,
                manual_status: document.getElementById('cfg-status').value
            };
            btnSaveSettings.disabled = true;
            btnSaveSettings.innerText = "Guardando...";
            try {
                const res = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: adminHeaders,
                    body: JSON.stringify(config)
                });
                if (res.ok) alert("Configuración pública actualizada con éxito.");
                else alert("Error interno al guardar.");
            } catch (e) {
                alert("Error de conexión guardando configuraciones.");
            } finally {
                btnSaveSettings.disabled = false;
                btnSaveSettings.innerText = "Guardar y Publicar Configuración";
            }
        });
    }

    const manualMovieForm = document.getElementById('manual-movie-form');
    if (manualMovieForm) {
        manualMovieForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-manual-submit');
            btn.disabled = true;
            btn.innerText = "Subiendo... paciencia";

            const formData = new FormData();
            formData.append('title', document.getElementById('manual-title').value);
            formData.append('genre', document.getElementById('manual-genre').value);
            formData.append('age_rating', document.getElementById('manual-age').value);
            formData.append('price', document.getElementById('manual-price').value);
            
            const posterFile = document.getElementById('manual-poster').files[0];
            const backdropFile = document.getElementById('manual-backdrop').files[0];
            
            if (posterFile) formData.append('poster', posterFile);
            if (backdropFile) formData.append('backdrop', backdropFile);

            try {
                const res = await fetch('/api/movies/manual', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    body: formData
                });
                
                if (res.ok) {
                    alert('¡Película subida y agregada con éxito!');
                    manualMovieForm.reset();
                    loadMovies();
                } else {
                    const data = await res.json();
                    alert('Error subiendo: ' + data.error);
                }
            } catch (err) {
                alert('No se pudo conectar para subir los archivos.');
            } finally {
                btn.disabled = false;
                btn.innerText = "Subir Archivos y Añadir a Cartelera";
            }
        });
    }

    loadMovies();
    loadSettings();
});
