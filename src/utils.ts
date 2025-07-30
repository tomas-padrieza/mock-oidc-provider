export function exit(message: string): never {
    console.error(message);
    process.exit(1);
}
