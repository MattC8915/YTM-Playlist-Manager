
export function log(msg) {
    let d = new Date()
    let args = [`[${d.toLocaleTimeString().replace(" PM", "").replace(" AM", "")}]`]
    args.push(...Array.prototype.slice.call(arguments))
    console.log.apply(console, args);
}