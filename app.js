// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
// REPLACE WITH YOUR VALUES
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyE8jRhs0F1txQ3Wc6iuqhKyBg_0GgQ6lIWwn_dJve4aM4Igdnd3i9kSS46YIitvvDz7g/exec';
const IMGBB_API_KEY = 'd42e94b83657f90f9f6694f95e50b4e8'; // Get free at https://api.imgbb.com

// ============================================
// DOM ELEMENTS
// ============================================
const addBookForm = document.getElementById('addBookForm');
const booksGrid = document.getElementById('booksGrid');
const loadingMessage = document.getElementById('loadingMessage');
const emptyState = document.getElementById('emptyState');
const submitBtn = document.getElementById('submitBtn');
const uploadProgress = document.getElementById('uploadProgress');
const bookImageInput = document.getElementById('bookImage');
const fileNameSpan = document.getElementById('fileName');
const refreshBtn = document.getElementById('refreshBtn');

// ============================================
// CACHE CONFIGURATION
// ============================================
let booksCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

// ============================================
// IMAGE COMPRESSION SETTINGS
// ============================================
const IMAGE_COMPRESSION_OPTIONS = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/jpeg'
};

// ============================================
// FILE INPUT HANDLER
// ============================================
bookImageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        fileNameSpan.textContent = `Selected: ${file.name} (${sizeMB} MB)`;
    } else {
        fileNameSpan.textContent = '';
    }
});

// ============================================
// UPLOAD IMAGE TO IMGBB
// ============================================
async function uploadImage(file) {
    // Compress first (fall back to original if compression fails)
    let fileToUpload = file;
    try {
        console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        fileToUpload = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
        console.log(`Compressed: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (compressionError) {
        console.warn('Compression failed, using original file:', compressionError);
        fileToUpload = file;
    }
    
    // Upload to ImgBB
    const formData = new FormData();
    formData.append('image', fileToUpload);
    
    let response;
    try {
        response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
    } catch (networkError) {
        throw new Error('ImgBB upload failed (network error). Check your internet connection.');
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(`ImgBB upload failed: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data.data.url;
}

// ============================================
// ADD BOOK FUNCTION
// ============================================
addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const owner = document.getElementById('ownerName').value.trim();
    const imageFile = bookImageInput.files[0];
    
    if (!title) {
        alert('Please enter a book title!');
        return;
    }
    
    if (imageFile && !imageFile.type.startsWith('image/')) {
        alert('Please select a valid image file!');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-text">Processing...</span>';
    uploadProgress.style.display = 'block';
    
    try {
        // Step 1: Compress and upload image (if provided)
        document.querySelector('.progress-text').textContent = 'Compressing...';
        document.querySelector('.progress-fill').style.width = '30%';
        
        const imageUrl = imageFile ? await uploadImage(imageFile) : '';
        
        // Step 2: Save to Google Sheets
        document.querySelector('.progress-text').textContent = 'Saving...';
        document.querySelector('.progress-fill').style.width = '70%';
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'add',
                title: title,
                author: author,
                owner: owner,
                image_url: imageUrl
            })
        });
        
        document.querySelector('.progress-fill').style.width = '100%';
        document.querySelector('.progress-text').textContent = 'Complete!';
        
        // Success
        alert('Book added successfully! 📚');
        addBookForm.reset();
        fileNameSpan.textContent = '';
        
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            document.querySelector('.progress-fill').style.width = '0%';
        }, 1500);
        
        // Reload books
        setTimeout(() => loadBooks(true), 2000);
        
    } catch (error) {
        console.error('Error adding book:', error);
        alert('Error adding book: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-text">Add Book</span>';
    }
});

// ============================================
// DELETE BOOK
// ============================================
async function deleteBook(title) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'delete',
                title: title
            })
        });

        alert('Book deleted!');
        setTimeout(() => loadBooks(true), 1000);

    } catch (error) {
        console.error('Error deleting book:', error);
        alert('Error deleting book!');
    }
}

// ============================================
// TOGGLE RENTAL STATUS
// ============================================
async function toggleRentalStatus(title, currentStatus) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'update',
                title: title,
                is_rented: !currentStatus
            })
        });
        
        // Reload books after short delay
        setTimeout(() => loadBooks(true), 1000);
        
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating book status!');
    }
}

// ============================================
// DISPLAY BOOKS
// ============================================
function displayBooks(books) {
    loadingMessage.style.display = 'none';
    
    if (books.length === 0) {
        booksGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    booksGrid.innerHTML = books.map((book, index) => `
        <div class="book-card ${book.is_rented ? 'rented' : ''}" style="animation-delay: ${index * 0.05}s">
            <img src="${book.image_url}" 
                 alt="${escapeHtml(book.title)}" 
                 class="book-image"
                 loading="lazy"
                 onload="this.classList.add('loaded')"
                 onerror="this.src='https://via.placeholder.com/280x350/667eea/ffffff?text=No+Image';this.classList.add('loaded')">
            <div class="book-info">
                <div class="book-title">${escapeHtml(book.title)}</div>
                <div class="book-author">by ${escapeHtml(book.author)}</div>
                <div class="book-owner">Owner: ${escapeHtml(book.owner)}</div>
                <span class="status-badge ${book.is_rented ? 'rented' : 'available'}">
                    ${book.is_rented ? '📖 Currently Rented' : '✅ Available'}
                </span>
                <button class="toggle-status-btn ${book.is_rented ? 'rented' : 'available'}" 
                        onclick="toggleRentalStatus('${escapeHtml(book.title)}', ${book.is_rented})">
                    ${book.is_rented ? 'Mark as Available' : 'Mark as Rented'}
                </button>
                <button class="delete-btn" onclick="deleteBook('${escapeHtml(book.title)}')">
                    🗑️ Delete Book
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// LOAD BOOKS (WITH CACHING)
// ============================================
async function loadBooks(forceRefresh = false) {
    try {
        const now = Date.now();
        
        // Use cache if available
        if (!forceRefresh && booksCache && (now - lastFetchTime) < CACHE_DURATION) {
            console.log('Using cached data');
            displayBooks(booksCache);
            return;
        }
        
        if (forceRefresh) {
            loadingMessage.style.display = 'block';
        }
        
        // Fetch from Google Sheets
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const books = await response.json();
        
        // Update cache
        booksCache = books || [];
        lastFetchTime = now;
        
        displayBooks(booksCache);
        
    } catch (error) {
        console.error('Error loading books:', error);
        loadingMessage.innerHTML = `
            <div style="color: #f44336;">
                <div style="font-size: 3em; margin-bottom: 10px;">⚠️</div>
                <div>Error loading books. Please refresh the page.</div>
                <button onclick="loadBooks(true)" style="margin-top: 15px; padding: 10px 20px; border: none; background: #667eea; color: white; border-radius: 6px; cursor: pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// REFRESH BUTTON
// ============================================
refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        refreshBtn.style.transform = '';
    }, 600);
    loadBooks(true);
});

// ============================================
// AUTO-REFRESH (Every 30 seconds)
// ============================================
setInterval(() => {
    loadBooks(true);
}, 30000);

// ============================================
// INITIALIZE
// ============================================
console.log('📚 Book Library App Initialized (Google Sheets)');
loadBooks(true);
