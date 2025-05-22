# MCP Server and Client Demo

This project demonstrates a Model Context Protocol (MCP) implementation with an Express.js server and a React.js client.

## Project Structure

- `src/`: Contains the MCP server implementation
- `mcp-client-test/`: Contains the React-based MCP client

## Setup

1. Install main project dependencies
```bash
npm install
```

2. Install server dependencies
```bash
cd src
npm install
```

3. Install client dependencies
```bash
cd mcp-client-test
npm install
```

## Running the Application

### Development Mode (both server and client)

```bash
npm run dev
```

This will start:
- MCP Server on port 3000
- React Client on port 3001

### Running Server Only

```bash
cd src
npm start
```

### Running Client Only

```bash
cd mcp-client-test
npm start
```

## Features

### Server
- MCP Server implementation with Express.js
- Authentication using @asgardeo/mcp-express
- Session management
- Two MCP tools implemented:
  - `get_pet_vaccination_info`
  - `book_vet_appointment`

### Client
- React-based chat interface
- Direct connection to MCP server
- Form-based interaction with MCP tools
- Real-time communication
- Session management

## Environment Variables

Create a `.env` file in the `src` directory with:

```
BASE_URL=http://localhost:3000
PORT=3000
```

And a `.env` file in the `mcp-client-test` directory with:

```
REACT_APP_MCP_SERVER_URL=http://localhost:3000/mcp
PORT=3001
```
