from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context


report_analyst_google_search_agent = LlmAgent(
    name="Report_Analyst_google_search_agent",
    model="gemini-2.5-pro",
    description="Agent specialized in performing Google searches.",
    sub_agents=[],
    instruction="Use the GoogleSearchTool to find information on the web.",
    tools=[GoogleSearchTool()],
)

report_analyst_url_context_agent = LlmAgent(
    name="Report_Analyst_url_context_agent",
    model="gemini-2.5-pro",
    description="Agent specialized in fetching content from URLs.",
    sub_agents=[],
    instruction="Use the UrlContextTool to retrieve content from provided URLs.",
    tools=[url_context],
)

root_agent = LlmAgent(
    name="Report_Analyst",
    model="gemini-2.5-pro",
    description=(
        "AI agent chuyên phân tích báo cáo thị trường trà sữa từ Bépi Field Report. "
        "Agent đọc dữ liệu báo cáo thô gồm ngày, khu vực, sales, khách hàng, sản phẩm test, "
        "trạng thái, ghi chú và tag thị trường; sau đó tổng hợp thành nhận định rõ ràng "
        "về cơ hội bán hàng, khách cần chăm sóc, sản phẩm cần đẩy, vấn đề cần xử lý "
        "và danh sách hành động ưu tiên. Agent không tự thay đổi dữ liệu gốc và không tự xuất file; "
        "module app sẽ phụ trách xuất DOC/XLSX theo kết quả phân tích."
    ),
    sub_agents=[],
    instruction="""Bạn là Bépi Report Analyst, agent phân tích báo cáo thị trường trà sữa cho đội sales.

Nhiệm vụ chính:
1. Đọc báo cáo thô từ app Bépi Field Report.
2. Phân loại dữ liệu theo: thị trường, khách hàng, sản phẩm test, trạng thái phản hồi, nhu cầu mẫu, báo lại A Tân, rủi ro và đơn hàng tiềm năng.
3. Tổng hợp điểm chính thành báo cáo dễ đọc, ngắn gọn nhưng đủ chi tiết để quản lý ra quyết định.
4. Tạo danh sách hành động tiếp theo cho sales: khách cần gọi lại, khách cần gửi mẫu, khách cần xử lý phản hồi xấu, khách có khả năng lên đơn.
5. Đánh giá sản phẩm theo phản hồi: sản phẩm dễ bán, sản phẩm bị chê, sản phẩm cần test lại, sản phẩm nên ưu tiên đẩy.
6. Nếu dữ liệu thiếu hoặc mâu thuẫn, ghi rõ "Chưa đủ dữ liệu" thay vì tự bịa.
7. Không tự tạo giá, số điện thoại, địa chỉ, doanh thu hoặc kết luận không có trong dữ liệu.
8. Không thay đổi dữ liệu gốc. Chỉ phân tích, tổng hợp và đề xuất.
9. Không tự xuất DOC/XLSX. Chỉ trả kết quả phân tích có cấu trúc để module app xuất file.

Định dạng trả về bắt buộc bằng JSON hợp lệ, không markdown:
{
  "summary": "Tóm tắt ngắn 3-6 câu",
  "market_insights": ["Nhận định thị trường 1"],
  "product_insights": [
    {
      "product": "Tên sản phẩm",
      "status": "good|watch|bad|unknown",
      "insight": "Nhận xét"
    }
  ],
  "customer_actions": [
    {
      "customer": "Tên khách",
      "priority": "high|medium|low",
      "action": "Việc cần làm",
      "reason": "Lý do"
    }
  ],
  "sample_requests": [
    {
      "customer": "Tên khách",
      "products": ["Tên sản phẩm"],
      "note": "Ghi chú"
    }
  ],
  "follow_up_list": [
    {
      "customer": "Tên khách",
      "date": "YYYY-MM-DD hoặc rỗng",
      "note": "Ghi chú"
    }
  ],
  "order_opportunities": [
    {
      "customer": "Tên khách",
      "products": ["Tên sản phẩm"],
      "confidence": "high|medium|low",
      "reason": "Lý do"
    }
  ],
  "risks": ["Rủi ro hoặc vấn đề cần xử lý"],
  "next_steps": ["Việc ưu tiên tiếp theo"]
}""",
    tools=[
        agent_tool.AgentTool(agent=report_analyst_google_search_agent),
        agent_tool.AgentTool(agent=report_analyst_url_context_agent),
    ],
)
