const express = require('express');
const fs = require('fs');
const path = require('path');
const LRU = require('lru-cache');  // Import LRU cache
const app = express();
const PORT = 3000;

const cache = new LRU({
    max: 40,  // Max 40 search queries will be cached
    ttl: 1000 * 60 * 5 // Optional: Set a time-to-live (TTL) of 5 minutes for each cache item
});

let transactions = [];

app.use(express.static(path.join(__dirname, '../public')));

fs.readFile(path.join(__dirname, 'transactions.json'), 'utf8', (err, data) => {
    if (err) {
        console.log('Load transactions error', err);
        return;
    }

    transactions = JSON.parse(data);
    transactions = transactions.sort(function(a, b){return a.amount - b.amount});
    transactions.forEach(trans => {
        trans['searchValue'] = trans.notes.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, "");
    });

    console.log("Loaded", transactions.length, "transactions");
        
    checkMemory();
});

app.get('/api/transactions', (req, res) => {
    // Get search query from request
    console.log('query', req.query.q);

    const query = (req.query.q ? req.query.q.toLowerCase() : '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, "");
    const amountQuery = query.replace(/\.+/g, '');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const cacheKey = query;

    let rawlist = cacheKey.length > 0 && cache.has(cacheKey) ? cache.get(cacheKey) : [];
    if (!rawlist || rawlist.length == 0 || !cache.has(cacheKey)) {
        rawlist = transactions.filter(transaction => transaction.searchValue.includes(query) || transaction.amount == amountQuery || transaction.code == query);
        if (cacheKey.length > 0) {
            cache.set(cacheKey, rawlist);
            console.log('Cached query result of keyword', cacheKey);
        }
        
        checkMemory();
    }

    // Pagination setup
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Paginate transactions
    const paginatedResults = rawlist.slice(startIndex, endIndex).map(transaction => {
            return {
                date: transaction.date,
                amount: numberWithCommas(transaction.amount),
                notes: transaction.notes,
                code: transaction.code,
            }
        });

    // Prepare response with pagination info
    const result = {
        currentPage: page,
        totalPages: Math.ceil(rawlist.length / limit),
        totalItems: rawlist.length,
        items: paginatedResults
    };

    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function checkMemory() {
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
    const memoryData = process.memoryUsage();
    const memoryUsage = {
      rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
      heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
      heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
      external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    };

    console.log(memoryUsage);
}