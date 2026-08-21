namespace RecordManager.Server.Models;

/// <summary>
/// A single manageable record. Mutated in place inside the in-memory store,
/// so the values survive for the lifetime of the process (but not a restart).
/// </summary>
public class RecordItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Status { get; set; } = "";
    public string Description { get; set; } = "";
}
