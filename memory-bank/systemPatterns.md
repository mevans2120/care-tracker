# System Patterns *Optional*

This file documents recurring patterns and standards used in the project.
It is optional, but recommended to be updated as the project evolves.
2025-06-21 10:35:02 - Log of updates made.

*

## Coding Patterns

*   

## Architectural Patterns

*   

## Testing Patterns

*
[2025-06-21 11:01:39] - STYLING SYSTEM: Custom CSS Utilities Architecture
- **Approach**: Utility-first CSS classes defined in globals.css
- **Structure**: 
  - Base reset and typography in globals.css
  - Utility classes for layout (flex, grid, spacing)
  - Color system with primary/secondary/gray scales
  - Responsive utilities with media queries
  - Component-specific styles as needed
- **Benefits**: 
  - No build tool dependencies or configuration issues
  - Full control over styling implementation
  - Consistent utility-first methodology
  - Easy to extend and customize
[2025-06-24 08:16:15] - **Claude PDF Processing Pattern**: Direct document processing using Claude's native capabilities
- **Pattern**: Use Claude's document API for PDF text extraction instead of external parsing libraries
- **Implementation**: 
  - Send base64-encoded PDF directly to Claude API with document processing request
  - Single API call handles both PDF reading and content analysis
  - Structured response matching TypeScript interfaces for type safety
- **Benefits**: 
  - Eliminates external library dependencies (pdf-parse, etc.)
  - More reliable text extraction with Claude's advanced document understanding
  - Single API call reduces complexity and potential failure points
  - Better handling of complex PDF layouts and medical terminology
- **Usage Pattern**: 
  ```typescript
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [{
      role: "user", 
      content: [{
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
      }, {
        type: "text",
        text: "Extract medical tasks from this PDF..."
      }]
    }]
  });
  ```
- **Error Handling**: Robust JSON parsing with validation and fallback mechanisms
- **Type Safety**: Response validation against TypeScript interfaces before processing
- **Naming Convention**: Following Tailwind-like patterns for familiarity