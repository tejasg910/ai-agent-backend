exports.extractCTC = text => {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:LPA|lakhs?)/i);
    return m ? parseFloat(m[1]) : null;
};
exports.extractNotice = text => {
    const m = text.match(/(\d+)\s*(?:days?|months?)/i);
    return m ? m[0] : null;
}; exports.extractDate = text => {
    // Naive date extraction (YYYY-MM-DD)
    const m = text.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
};  