---
description: Run one explicitly requested Council of Intel deliberation (multiple model calls, possible cost)
argument-hint: "[sats|council] <question and optional seats/model choices>"
---
The user explicitly requests one Council of Intel deliberation using these arguments:

$ARGUMENTS

Call council_of_intel exactly once, as the only tool call in its batch. Default to sats if no mode is specified. Pass the user's question and any explicit seats/provider/model/chairman/counterfactual choices in the structured tool parameters. Do not invent evidence. If there is no question, ask for one without calling the tool.

This request authorizes multiple nested model calls to the configured/scoped Pi models; they may incur cost and share the question and evidence with those providers. Do not invoke any other tools, run a second deliberation, automatically retry an error or follow up after the terminal receipt. The tool returns the complete Markdown deliverable and ends this one-shot operation.
