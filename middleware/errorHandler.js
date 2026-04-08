// Error Handling Middleware
function errorHandler(err, req, res, next) {
    console.error(`[Error] ${err.message}`);
    console.error(err.stack);

    const statusCode = err.status || 500;
    
    if (req.accepts('html')) {
        // Fallback HTML error response
        res.status(statusCode).send(`
            <html>
                <head><title>Error ${statusCode}</title></head>
                <body>
                    <h1>Oops! Something went wrong.</h1>
                    <p><strong>Error:</strong> ${err.message}</p>
                    ${process.env.NODE_ENV === 'development' ? `<pre>${err.stack}</pre>` : ''}
                    <a href="/">Go back to Home</a>
                </body>
            </html>
        `);
    } else if (req.accepts('json')) {
        res.status(statusCode).json({
            status: 'error',
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    } else {
        res.status(statusCode).type('txt').send(`Error ${statusCode}: ${err.message}`);
    }
}

module.exports = errorHandler;