function defaultFetchHeaders() {
    return {
        "Accept": "application/json",
        "User-Agent": `Node/${process.version} Github/Joshua-Noakes1/camerons-clio`
    }
}

module.exports = defaultFetchHeaders;