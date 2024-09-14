const express = require('express');
const fs = require('fs');
const path = require('path');
const LRU = require('lru-cache');  // Import LRU cache

const log4js = require("log4js");

log4js.configure({
    appenders: {
        application: {
            type: 'console'
        },
        file: {
            type: 'file',
            filename: `./logs/application.log`,
            compression: true,
            maxLogSize: '10M',
            backups: 100
        }
    },
    categories: {
        default: {
            appenders: ['application', 'file'],
            level: 'all',
            enableCallStack: true
        }
    },
});

const logger = log4js.getLogger("CheckVar");

const app = express();
const PORT = 30001;

const cache = new LRU({
    max: 80,  // Max 40 search queries will be cached
    ttl: 1000 * 60 * 5 // Optional: Set a time-to-live (TTL) of 5 minutes for each cache item
});

let transactions = [];

app.use(express.static(path.join(__dirname, 'ui')));

fs.readFile(path.join(__dirname, 'transactions.json'), 'utf8', (err, data) => {
    if (err) {
        logger.debug('Load transactions error', err);
        return;
    }

    transactions = JSON.parse(data);
    transactions.forEach(trans => {
        trans['searchValue'] = trans.notes.toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, "")
            .replace(/đ+/g, "d");
        trans.amount = parseInt(trans.amount.toString().replace(/,+/g, ""));
    });
    transactions = transactions.sort(function(a, b){return a.amount - b.amount});

    logger.debug("Loaded", transactions.length, "transactions", checkMemory());
});

app.get('/api/transactions', (req, res) => {
    // Get search query from request
    logger.debug('query', req.query.q);

    const query = (req.query.q ? req.query.q.toLowerCase() : '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, "")
        .replace(/đ+/g, "d");

    const amountQuery = query.replace(/\.+/g, '');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const cacheKey = query;

    let filteredTransactions = cacheKey.length > 0 ? (cache.has(cacheKey) ? cache.get(cacheKey) : []) : transactions;
    if (!filteredTransactions || filteredTransactions.length === 0) {
        filteredTransactions = transactions.filter(transaction => transaction.searchValue.includes(query) || transaction.amount === amountQuery || transaction.code === query);
    }

    if (cacheKey.length > 0 && !cache.has(cacheKey)) {
        cache.set(cacheKey, filteredTransactions);
        logger.debug('Cached query result of keyword', cacheKey, checkMemory());
    }

    // Pagination setup
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Paginate transactions
    const paginatedResults = filteredTransactions.slice(startIndex, endIndex).map(transaction => {
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
        totalPages: Math.ceil(filteredTransactions.length / limit),
        totalItems: filteredTransactions.length,
        items: paginatedResults
    };

    res.json(result);
});

app.listen(PORT, () => {
    logger.debug(`Server is running on http://localhost:${PORT}`);
});

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function checkMemory() {
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
    const memoryData = process.memoryUsage();
    // const memoryUsage = {
    //   rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
    //   heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
    //   heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
    //   external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    // };

    // logger.debug(memoryUsage);

    return `| Memory usage: ${formatMemoryUsage(memoryData.rss)}`;
}