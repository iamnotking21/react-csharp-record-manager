using RecordManager.Server.Models;

var builder = WebApplication.CreateBuilder(args);

// CORS is part of the ASP.NET Core shared framework - no NuGet package added.
const string ClientCors = "ClientCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(ClientCors, policy => policy
        .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors(ClientCors);

// ---------------------------------------------------------------------------
// In-memory store. Hard-coded seed data, no database, no data files.
// Deliberately 3 Active / 2 Completed / 1 On Hold so the grouped summary is
// non-trivial and visibly moves when a status is edited.
// ---------------------------------------------------------------------------
var records = new List<RecordItem>
{
    new() { Id = 1, Name = "Client Portal Redesign",  Category = "Web",        Status = "Active",    Description = "Refresh of the customer-facing portal UI." },
    new() { Id = 2, Name = "Payroll Migration",       Category = "Internal",   Status = "On Hold",   Description = "Move payroll processing to the new provider." },
    new() { Id = 3, Name = "Mobile App v2",           Category = "Mobile",     Status = "Active",    Description = "Second-generation iOS/Android release." },
    new() { Id = 4, Name = "Data Warehouse Cleanup",  Category = "Data",       Status = "Completed", Description = "Archive stale tables and rebuild indexes." },
    new() { Id = 5, Name = "Security Audit 2026",     Category = "Compliance", Status = "Active",    Description = "Annual penetration test and remediation." },
    new() { Id = 6, Name = "Onboarding Automation",   Category = "Internal",   Status = "Completed", Description = "Automate new-hire account provisioning." },
};

app.MapGet("/api/records", () => Results.Ok(records));

app.MapGet("/api/records/{id:int}", (int id) =>
{
    var record = records.FirstOrDefault(r => r.Id == id);
    return record is null ? Results.NotFound() : Results.Ok(record);
});

app.MapPut("/api/records/{id:int}", (int id, RecordUpdate update) =>
{
    var record = records.FirstOrDefault(r => r.Id == id);
    if (record is null) return Results.NotFound();

    if (string.IsNullOrWhiteSpace(update.Name))
        return Results.BadRequest(new { error = "Name is required." });

    // Mutate the stored instance in place so the change persists for the
    // process lifetime. The client replaces its copy immutably with the result.
    record.Name = update.Name.Trim();
    record.Category = update.Category.Trim();
    record.Status = update.Status.Trim();
    record.Description = update.Description.Trim();

    return Results.Ok(record);
});

app.Run();
