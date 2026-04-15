// Configuration - REPLACE WITH YOUR VALUES
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxDPNEB8WNglWKltigsroKaYlnSxAVqAHRf_3IIbkkNqReDBtd0RmB0ouRG7KOfKgrv6w/exec';
const IMGBB_API_KEY = 'd42e94b83657f90f9f6694f95e50b4e8'; // Get free at https://api.imgbb.com

// DOM Elements
const addBookForm = document.getElementById('addBookForm');
const booksGrid = document.getElementById('booksGrid');
const loadingMessage = document.getElementById('loadingMessage');
const submitBtn = document.getElementById('submitBtn');
const uploadProgress = document.getElementById('uploadProgress');
const bookImageInput = document.getElementById('bookImage');
const fileNameSpan = document.getElementById('fileName');

// Show selected file name
bookImageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameSpan.textContent = `Selected: ${e.target.files[0].name}`;
    } else {
        fileNameSpan.textContent = '';
    }
});

// Upload image to ImgBB
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error('Image upload failed');
    }
    
    return data.data.url;
}

// Add Book Function
addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const owner = document.getElementById('ownerName').value.trim();
    const imageFile = bookImageInput.files[0];
    
    if (!title || !author || !owner || !imageFile) {
        alert('Please fill all fields and select an image!');
        return;
    }
    
    // Validate image size (max 5MB)
    if (imageFile.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB!');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    uploadProgress.style.display = 'block';
    
    try {
        // Upload image
        const imageUrl = await uploadImage(imageFile);
        
        // Add book to Google Sheets
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add',
                title: title,
                author: author,
                owner: owner,
                image_url: imageUrl
            })
        });
        
        alert('Book added successfully! 📚\n\nRefresh the page to see it.');
        addBookForm.reset();
        fileNameSpan.textContent = '';
        
        // Reload books after 2 seconds
        setTimeout(() => {
            loadBooks();
        }, 2000);
        
    } catch (error) {
        console.error('Error adding book:', error);
        alert('Error adding book: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Book';
        uploadProgress.style.display = 'none';
    }
});

// Delete Book
async function deleteBook(image_url) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete',
                image_url: image_url
            })
        });

        alert('Book deleted!');
        setTimeout(() => {
            loadBooks();
        }, 1000);

    } catch (error) {
        console.error('Error deleting book:', error);
        alert('Error deleting book!');
    }
}

// Toggle Book Rental Status
async function toggleRentalStatus(image_url, currentStatus) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update',
                image_url: image_url,
                is_rented: !currentStatus
            })
        });
        
        // Reload books
        setTimeout(() => {
            loadBooks();
        }, 1000);
        
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating book status!');
    }
}

// Display Books
function displayBooks(books) {
    if (books.length === 0) {
        loadingMessage.textContent = 'No books yet. Add the first one! 📖';
        booksGrid.innerHTML = '';
        return;
    }
    
    loadingMessage.style.display = 'none';
    
    booksGrid.innerHTML = books.map(book => `
        <div class="book-card ${book.is_rented ? 'rented' : ''}">
            <img src="${book.image_url}" 
                 alt="${escapeHtml(book.title)}" 
                 class="book-image"
                 onerror="this.src='https://via.placeholder.com/280x350/667eea/ffffff?text=No+Image'">
            <div class="book-info">
                <div class="book-title">${escapeHtml(book.title)}</div>
                <div class="book-author">by ${escapeHtml(book.author)}</div>
                <div class="book-owner">Owner: ${escapeHtml(book.owner)}</div>
                <a class="image-link" href="${book.image_url}" target="_blank" rel="noopener noreferrer">🔗 View Photo</a>
                <span class="status-badge ${book.is_rented ? 'rented' : 'available'}">
                    ${book.is_rented ? '📖 Currently Rented' : '✅ Available'}
                </span>
                <button class="toggle-status-btn ${book.is_rented ? 'rented' : 'available'}" 
                        onclick="toggleRentalStatus('${book.image_url}', ${book.is_rented})">
                    ${book.is_rented ? 'Mark as Available' : 'Mark as Rented'}
                </button>
                <button class="delete-btn" onclick="deleteBook('${book.image_url}')">
                    🗑️ Delete Book
                </button>
            </div>
        </div>
    `).join('');
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load Books from Google Sheets
async function loadBooks() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const books = await response.json();
        displayBooks(books);
    } catch (error) {
        console.error('Error loading books:', error);
        loadingMessage.textContent = 'Error loading books. Please refresh.';
    }
}

// Auto-refresh every 10 seconds to show updates
setInterval(loadBooks, 10000);

// Initial load
loadBooks();
