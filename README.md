\# Doorbell Without Ears



\*\*An accessibility-first visitor notification and response prototype powered by MCP.\*\*



Doorbell Without Ears is a web-based prototype designed to help people who may not hear a doorbell easily manage visitor events through a visual dashboard. It provides simulated visitor notifications, configurable accessibility preferences, and a human-confirmed reply workflow.



\## Features



\- \*\*Visual visitor dashboard\*\* — view simulated doorbell, motion, and knock events.

\- \*\*Accessible interface\*\* — configurable text size, high contrast, and optional flash alerts.

\- \*\*Custom visitor instructions\*\* — configure delivery instructions and responses for unknown visitors.

\- \*\*Reply suggestions\*\* — generate a proposed response for review.

\- \*\*Human approval\*\* — explicitly confirm or reject a proposed response.

\- \*\*Action history\*\* — inspect recorded actions.

\- \*\*MCP integration\*\* — expose visitor-event and preference workflows through seven MCP tools.

\- \*\*Local REST API\*\* — manage events, preferences, proposed replies, and dismissal actions.



\## Technology Stack



\- Node.js

\- TypeScript

\- Express

\- Model Context Protocol (MCP) SDK

\- Zod

\- Vitest

\- HTML, CSS, and JavaScript



\## Requirements



\- Node.js and npm

\- Windows PowerShell or another compatible terminal



\## Installation



Clone or download this repository, then open PowerShell in the project directory.



Install dependencies:



```powershell

npm install

```



Start the development server:



```powershell

npm run dev

```



Open the dashboard:



http://127.0.0.1:3000



Health endpoint:



http://127.0.0.1:3000/health



MCP endpoint:



http://127.0.0.1:3000/mcp



\## Testing



Run automated tests:



```powershell

npm test

```



Compile the TypeScript project:



```powershell

npm run build

```



\## MCP Tools



The prototype exposes seven MCP tools:



1\. `get\_visitor\_events` — retrieve visitor events.

2\. `get\_preferences` — retrieve accessibility and response preferences.

3\. `update\_preference` — update a preference.

4\. `propose\_reply` — prepare a reply suggestion.

5\. `confirm\_reply` — confirm or reject a proposed reply.

6\. `correct\_inference` — correct a visitor classification.

7\. `dismiss\_event` — dismiss a visitor event.



The MCP endpoint can be tested with an MCP-compatible client such as MCP Inspector.



\## Architecture



The project separates its main responsibilities into:



\- `src/server/` — Express server and REST API.

\- `src/services/` — event, preference, approval, and action-history logic.

\- `src/mcp/` — MCP server and tool definitions.

\- `public/` — browser dashboard assets.

\- `tests/` — automated tests.



\## Current Limitations



\*\*This is a prototype.\*\*



\- Visitor events are simulated; a live Ring doorbell connection is not configured.

\- The current implementation uses in-memory stores, so data is not guaranteed to survive a server restart.

\- Reply suggestions should be treated as proposed content and reviewed by a person before confirmation.

\- A production deployment would need appropriate authentication, secure configuration, persistent storage, and additional security testing.

\- - Reply generation runs locally using saved templates. The project does not call paid AI APIs or require AWS services.



\## Demo Walkthrough



1\. Start the development server.

2\. Open the dashboard in a browser.

3\. Simulate a visitor event.

4\. Review the event and request a reply suggestion.

5\. Confirm or reject the suggestion.

6\. Dismiss an event.

7\. Change accessibility preferences and save them.

8\. Inspect the action history.

9\. Optionally connect MCP Inspector to the MCP endpoint and demonstrate the available tools.



\## Project Goal



The goal is to explore how visual notifications, configurable accessibility settings, and human-controlled response workflows can make visitor interactions more accessible.



\## License



Add the license required by your project or hackathon before publishing or distributing the repository.



