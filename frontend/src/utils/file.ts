export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("FileReader did not produce a data URL"))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"))
    reader.readAsDataURL(file)
  })
}
