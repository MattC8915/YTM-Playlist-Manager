
export function log(msg) {
    let d = new Date()
    console.log(`[${d.toLocaleTimeString()}] ${msg}`)
}