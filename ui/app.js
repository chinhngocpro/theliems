let currentPage = 1;
const limit = 10;
let debounceTimeout;

// Fetch data from backend API with pagination
function fetchTransactions(query = '', page = 1) {
    fetch(`api/transactions?q=${query}&page=${page}&limit=${limit}`)
        .then(response => response.json())
        .then(data => {
            displayTransactions(data.items);
            updatePagination(data.currentPage, data.totalPages);
        })
        .catch(error => console.error('Error fetching data:', error));
}

// Display the transactions on the page
function displayTransactions(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    data.forEach(transaction => {
        const transactionDiv = document.createElement('div');
        transactionDiv.className = 'transaction';
        transactionDiv.innerHTML = `
            <p><strong>Date:</strong> ${transaction.date}</p>
            <p><strong>Amount:</strong> ${transaction.amount}</p>
            <p><strong>Notes:</strong> ${transaction.notes}</p>
            <p><strong>Code:</strong> ${transaction.code}</p>
        `;
        resultsDiv.appendChild(transactionDiv);
    });
}

// Update pagination buttons
function updatePagination(currentPage, totalPages) {
    const paginationDivPrev = document.getElementById('pagination-prev');
    const paginationDivNext = document.getElementById('pagination-next');
    const paginationDivInfo = document.getElementById('pagination-info');
    paginationDivPrev.innerHTML = '';
    paginationDivNext.innerHTML = '';
    paginationDivInfo.innerHTML = currentPage + '/' + totalPages;

    const firstButton = document.createElement('button');
    firstButton.textContent = 'First';
    firstButton.onclick = () => changePage(0);
    firstButton.disabled = true;
    paginationDivPrev.appendChild(firstButton);

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.onclick = () => changePage(currentPage - 1);
    prevButton.disabled = true;
    paginationDivPrev.appendChild(prevButton);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => changePage(currentPage + 1);
    nextButton.disabled = true;
    paginationDivNext.appendChild(nextButton);


    const lastButton = document.createElement('button');
    lastButton.textContent = 'Last';
    lastButton.onclick = () => changePage(totalPages);
    lastButton.disabled = true;
    paginationDivNext.appendChild(lastButton);

    if (currentPage > 1) {        
        firstButton.disabled = false;
        prevButton.disabled = false;
    }

    if (currentPage < totalPages) {
        nextButton.disabled = false;
        lastButton.disabled = false;
    }
}

// Change page and fetch new results
function changePage(page) {
    currentPage = page;
    const query = document.getElementById('searchInput').value.toLowerCase();
    fetchTransactions(query, currentPage);
}

// Debounce function to delay search until user stops typing
function debounceSearch() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        filterTransactions();
    }, 1000); // Wait 1 second after the last keystroke before performing the search
}

// Search function
function filterTransactions() {
    currentPage = 1; // Reset to page 1 when searching
    const query = document.getElementById('searchInput').value.toLowerCase();
    fetchTransactions(query, currentPage);
}
