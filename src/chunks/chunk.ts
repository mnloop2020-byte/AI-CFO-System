export function splitTextIntoChunks(text: string): string[] {
    // string[] => means that the function will return an array of strings
    const chunkSize = 500;
    // the size what we want to split the text into
    const chunks: string[] = [];
//  string[] this variable contains an array of strings like means that place we gonna store the chunks [chunk1, chunk2, chunk3, chunk4, chunk5]

    for (let i = 0; i < text.length; i += chunkSize) {

        const chunk = text.slice(i, i + chunkSize);
        chunks.push(chunk);
        // push is a method that adds a new element to the end of the array
    }
        return chunks;
    }



