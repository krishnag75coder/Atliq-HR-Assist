# Atliq HR Assist - MCP Server

Atliq HR Assist is a Model Context Protocol (MCP) server built with FastMCP. It provides a comprehensive set of Human Resources management tools to be used by an AI agent, streamlining operations like employee onboarding, leave management, IT ticketing, and communications.

## Features

This MCP server exposes several domains of HR functionality as distinct tools:

### 👥 Employee Management
- `add_employee`: Add a new employee to the directory.
- `get_employee_details`: Retrieve detailed information for a specific employee.
- `update_employee`: Update existing employee details (email, name, manager).

### 🏖️ Leave Management
- `get_leave_balance`: Check an employee's available leave balance.
- `apply_leave`: Apply for leave specifying specific dates.
- `get_leave_history`: View an employee's past leave history.

### 📅 Meeting Management
- `schedule_meeting`: Schedule meetings (e.g., introductory meetings for onboarding) at specific dates and times.

### 🎫 IT Support & Ticketing
- `create_ticket`: Raise a new IT or support ticket (e.g., for hardware or ID cards).
- `update_ticket`: Update the status of an existing ticket.
- `list_tickets`: View all tickets, optionally filtered by employee ID or status.

### 📧 Communications
- `send_emails`: Send emails to employees or managers for notifications, welcomes, or meeting invites.

## Included Prompts

- `onboard_new_employee`: Provides an automated checklist and sequence for the agent to execute for onboarding a newly hired employee. It encompasses adding them to the system, sending a welcome email, getting hardware issued via tickets, scheduling an intro meeting, and doing a trial leave request.

## Prerequisites

- **Python:** 3.10 or higher.
- A valid `.env` file must be present at the root of the project with your email credentials for the `send_emails` tool to function:
  ```env
  CB_EMAIL=your-email@example.com
  CB_EMAIL_PWD=your-app-specific-password
  ```

## Installation & Usage

You can run the MCP server locally using the `mcp-cli` or via standard Python execution (since it connects via `stdio`).

If you're using `uv` or `pip`, make sure your dependencies are installed:
```bash
# Using uv (if applicable)
uv sync

# Or alternatively via pip
pip install -r pyproject.toml
```

To run the server:
```bash
python server.py
```
*(The server is configured to run via `stdio` transport by default).*
