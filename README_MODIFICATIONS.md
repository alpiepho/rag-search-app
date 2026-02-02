
- from https://www.freecodecamp.org/news/how-to-build-an-ai-powered-rag-search-application-with-nextjs-supabase-and-openai/ 
- created fork of https://github.com/mayur9210/rag-search-app

## Development Environment Changes

The existing application and tutorial rely on several external services.  We want these to be local.  More specifically:

- File fcc_page_contents.html contains the core html from the freecodecamp link above describing the tutorial
- Want to use Docker instead of installing tools like Node.js 18
- Want this directory mapped into the docker container for the rag-search-app itself
- Want a local self hosted Supabase instance instead of the public version
- Want a docker compose file to startup and tear down the containers
- Want to use local ollama at 10.0.0.60:11434 instead of OpenAI
- Want to use model Llama3.1:8b instead of gpt-4o-mini

## Running from Docker Hints

```
detach from container and leave running:
ctrl-p ctrl-q

re-attach to running container:
docker attach <container_id>
or 
docker attach <container_name>

```
