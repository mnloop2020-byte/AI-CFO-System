// It only creates a way for your application to talk to the model.
// we have installed the openai to call the liballaries (npm install openai )
// OpenAI Client,Chat API,Embeddings,Responses API,Streaming,Tools

import "dotenv/config";
import OpenAI from"openai"

const llm = new OpenAI({
// OpenAI it comes form the import OpenAI from 'openai'
// new OpenAI()
// Creates a client for communicating with OpenAI services and models.


 apiKey: process.env.OPENROUTER_API_KEY,
 baseURL: "https://openrouter.ai/api/v1",

})
// process.env
// Used to access values from .env file


// apiKey: it's property 
// Configuration field used to pass OpenAI key

export default llm;
//  allow as to use this code in any files
