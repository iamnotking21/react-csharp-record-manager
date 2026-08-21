namespace RecordManager.Server.Models;

/// <summary>
/// Payload accepted by PUT /api/records/{id}. Id is deliberately absent:
/// the route supplies it, so a mismatched body cannot re-key a record.
/// </summary>
public class RecordUpdate
{
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Status { get; set; } = "";
    public string Description { get; set; } = "";
}
