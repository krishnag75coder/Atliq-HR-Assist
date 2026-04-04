from mcp.server.fastmcp import FastMCP
from hrms import *
from utils import seed_services
from typing import Dict , List , Optional
from emails import EmailSender
import os
from dotenv import load_dotenv
from datetime import datetime, date

load_dotenv()

email_sender = EmailSender(
        smtp_server="smtp.gmail.com",
        port=587,
        username=os.getenv("CB_EMAIL"),
        password=os.getenv("CB_EMAIL_PWD"),
        use_tls=True
    )
mcp = FastMCP("atliq-hr-assist")

employee_manager = EmployeeManager()
leave_manager = LeaveManager()
meeting_manager = MeetingManager()
ticket_manager = TicketManager()


seed_services(employee_manager, leave_manager, meeting_manager, ticket_manager)

@mcp.tool()
def add_employee(emp_name: str, manager_id: Optional[str] = None, email: Optional[str] = None) -> str:
    if manager_id and manager_id.strip() == "":
        manager_id = None

    if manager_id:
        # Resolve manager ID if a name was provided instead
        if not manager_id.startswith("E"):
            matches = employee_manager.search_employee_by_name(manager_id)
            if not matches:
                raise ValueError(f"Manager '{manager_id}' not found.")
            manager_id = matches[0]

    emp = EmployeeCreate(
        emp_id=employee_manager.get_next_emp_id(),
        name=emp_name,
        manager_id=manager_id,
        email=email
    )
    employee_manager.add_employee(emp)
    return f"Employee {emp_name} with ID {emp.emp_id} is successfully added. Assigned Manager: {manager_id if manager_id else 'None'}"

@mcp.tool()
def get_employee_details(name: str) -> Dict[str, str]:
    matches = employee_manager.search_employee_by_name(name)
    if len(matches) == 0:
        raise ValueError(f"No Employee found matching '{name}'.")
    emp_id = matches[0]
    return employee_manager.get_employee_details(emp_id)

@mcp.tool()
def update_employee(emp_id: str, email: Optional[str] = None, name: Optional[str] = None, manager_id: Optional[str] = None) -> str:
    """Update existing employee details. Useful for updating an email address, manager assignment, or name."""
    if manager_id and manager_id.strip() == "":
        manager_id = None

    if manager_id:
        # Resolve manager ID if a name was provided instead
        if not manager_id.startswith("E"):
            matches = employee_manager.search_employee_by_name(manager_id)
            if not matches:
                raise ValueError(f"Manager '{manager_id}' not found.")
            manager_id = matches[0]

    return employee_manager.update_employee(emp_id=emp_id, email=email, name=name, manager_id=manager_id)

@mcp.tool()
def send_emails(subject : str , body : str , to_emails : List[str] | str):
    email_sender.send_email(
        subject=subject,
        body=body,
        to_emails=to_emails,
        from_email=email_sender.username
    )
    print("Email sent successfully!")

@mcp.tool()
def create_ticket(emp_id: str, item: str, reason: str) -> str:
    ticket = TicketCreate(
        emp_id=emp_id,
        item=item,
        reason=reason
    )
    return ticket_manager.create_ticket(ticket)

@mcp.tool()
def update_ticket(ticket_id: str, status: TicketStatus) -> str:
    req = TicketStatusUpdate(status=status)
    return ticket_manager.update_ticket_status(req, ticket_id)

@mcp.tool()
def list_tickets(employee_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, str]]:
    return ticket_manager.list_tickets(employee_id, status)

@mcp.tool()
def schedule_meeting(emp_id: str, meeting_dt: str, topic: str = "Introductory Meeting") -> str:
    """Schedule a meeting for an employee at a specific datetime (ISO format, e.g., YYYY-MM-DDTHH:MM:SS), typically an introductory meeting."""
    try:
        dt = datetime.fromisoformat(meeting_dt)
    except ValueError:
        raise ValueError("Invalid datetime format. Please use ISO format (e.g. YYYY-MM-DDTHH:MM:SS).")
    req = MeetingCreate(emp_id=emp_id, meeting_dt=dt, topic=topic)
    return meeting_manager.schedule_meeting(req)

@mcp.tool()
def get_leave_balance(emp_id: str) -> str:
    """Get the available leave balance for an employee."""
    return leave_manager.get_leave_balance(emp_id)

@mcp.tool()
def apply_leave(emp_id: str, leave_dates: List[str]) -> str:
    """Apply for leave by providing a list of leave dates (ISO format strings, e.g. YYYY-MM-DD)."""
    try:
        dates = [date.fromisoformat(d) for d in leave_dates]
    except ValueError:
        raise ValueError("Invalid date format in leave_dates. Please use ISO format (YYYY-MM-DD).")
    req = LeaveApplyRequest(emp_id=emp_id, leave_dates=dates)
    return leave_manager.apply_leave(req)

@mcp.tool()
def get_leave_history(emp_id: str) -> str:
    """Get the leave history of an employee."""
    return leave_manager.get_leave_history(emp_id)

@mcp.prompt()
def onboard_new_employee(employee_name: str , manager_name: str , email: str):
    return f"""
    You are an HR assistant for Atliq Technologies.
    Onboard a new employee by:
    1. Adding the employee using the add_employee tool.
    2. Sending a welcome email to the employee using the send_emails tool.
    3. Notify the manager about the new employee's onboarding.
    4. Raise tickets for a new laptop,id card and other necessary items.
    5. Schedule an introductory meeting with the new employee (pick any upcoming date and time via ISO format).
    6. Notify both the employee and manager about the scheduled meeting (you can use a single email or separate emails).
    7. Get the leave balance of the new employee.
    8. Apply for 1 day of leave for the new employee (pick any upcoming date in YYYY-MM-DD format).
    9. Get the leave history of the new employee.

    IMPORTANT: You must execute ALL 9 steps sequentially. Do not stop until every single step has been executed.
    
    Employee Details:
    - Name: {employee_name}
    - Manager: {manager_name}
    - Email: {email}
    
    The email should include:
    - A warm welcome message
    - Their manager's name
    - Instructions to contact HR for any queries
    """
    

if __name__ == "__main__":
    mcp.run(transport="stdio")

