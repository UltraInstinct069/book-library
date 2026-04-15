// Firebase Configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyABe3-mj9AyWRwAwkX9x7NXZFLU17KOE8g",
  authDomain: "book-library-db-b4427.firebaseapp.com",
  projectId: "book-library-db-b4427",
  storageBucket: "book-library-db-b4427.firebasestorage.app",
  messagingSenderId: "65859516491",
  appId: "1:65859516491:web:d040213985074a01f4f5ce",
  measurementId: "G-K8SLPNG0S5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// DOM Elements
const addBookForm = document.getElementById('addBookForm');
const booksGrid = document.getElementById('booksGrid');
const loadingMessage = document.getElementById('loadingMessage');
const submitBtn = document.getElementById('submitBtn');
const uploadProgress = document.getElementById('uploadProgress');

// Add Book Function
addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const owner = document.getElementById('ownerName').value.trim();
    const imageFile = document.getElementById('bookImage').files[0];
    
    if (!title || !author || !owner || !imageFile) {
        alert('Please fill all fields and select an image!');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    uploadProgress.style.display = 'block';
    
    try {
        // Upload image to Firebase Storage
        const timestamp = Date.now();
        const imageName = `${timestamp}_${imageFile.name}`;
        const storageRef = storage.ref('book-images/' + imageName);
        const uploadTask = storageRef.put(imageFile);
        
        // Monitor upload progress
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                document.querySelector('.progress-fill').style.width = progress + '%';
            }
        );
        
        // Wait for upload to complete
        await uploadTask;
        const imageUrl = await storageRef.getDownloadURL();
        
        // Add book to Firestore
        await db.collection('books').add({
            title: title,
            author: author,
            owner: owner,
            imageUrl: imageUrl,
            isRented: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Book added successfully!');
        addBookForm.reset();
        uploadProgress.style.display = 'none';
        document.querySelector('.progress-fill').style.width = '0%';
        
    } catch (error) {
        console.error('Error adding book:', error);
        alert('Error adding book: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Book';
    }
});

// Toggle Book Rental Status
async function toggleRentalStatus(bookId, currentStatus) {
    try {
        await db.collection('books').doc(bookId).update({
            isRented: !currentStatus
        });
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating book status!');
    }
}

// Display Books
function displayBooks(books) {
    if (books.length === 0) {
        loadingMessage.textContent = 'No books yet. Add the first one!';
        booksGrid.innerHTML = '';
        return;
    }
    
    loadingMessage.style.display = 'none';
    
    booksGrid.innerHTML = books.map(book => `
        <div class="book-card ${book.isRented ? 'rented' : ''}">
            <img src="${book.imageUrl}" alt="${book.title}" class="book-image">
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">by ${book.author}</div>
                <div class="book-owner">Owner: ${book.owner}</div>
                <span class="status-badge ${book.isRented ? 'rented' : 'available'}">
                    ${book.isRented ? '📖 Currently Rented' : '✅ Available'}
                </span>
                <button class="toggle-status-btn ${book.isRented ? 'rented' : 'available'}" 
                        onclick="toggleRentalStatus('${book.id}', ${book.isRented})">
                    ${book.isRented ? 'Mark as Available' : 'Mark as Rented'}
                </button>
            </div>
        </div>
    `).join('');
}

// Real-time Listener for Books
db.collection('books')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
        const books = [];
        snapshot.forEach((doc) => {
            books.push({
                id: doc.id,
                ...doc.data()
            });
        });
        displayBooks(books);
    }, (error) => {
        console.error('Error fetching books:', error);
        loadingMessage.textContent = 'Error loading books. Please refresh the page.';
    });
