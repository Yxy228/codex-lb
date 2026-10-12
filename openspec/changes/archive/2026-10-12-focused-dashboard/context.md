# Page responsibilities

Homepage answers whether the relay is healthy and how much account capacity remains. Usage reports summarize consumption; cache analysis explains input reuse; request records support investigating errors, latency, transport and archives. These destinations share source data but offer distinct tasks. For example a low cache ratio is investigated on cache analysis, while an upstream timeout is investigated on request records.

Reuse the existing diagnostic UI rather than remove its error/transport/archive capabilities. The homepage does not poll detailed request data. /reports/requests inherits dashboard:read; conversation capabilities keep conversations:read checks. Historical URL filter handling stays in the diagnostic destination.
