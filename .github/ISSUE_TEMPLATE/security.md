name: Security Report
description: Report a security vulnerability privately
title: "[Security] "
labels: ["security"]
body:
  - type: markdown
    attributes:
      value: |
        Please use this template to report a security vulnerability. 
        **Note:** If you are reporting a critical vulnerability, please email us directly at ncsound919@gmail.com instead of opening a public issue.
  - type: textarea
    id: vulnerability-description
    attributes:
      label: Vulnerability Description
      description: Describe the vulnerability and how it can be reproduced.
    validations:
      required: true
  - type: textarea
    id: reproduction-steps
    attributes:
      label: Steps to Reproduce
      description: Provide clear, step-by-step instructions to reproduce the vulnerability.
    validations:
      required: true
  - type: textarea
    id: mitigation-suggestion
    attributes:
      label: Mitigation Suggestion
      description: Optional: provide any suggestions on how to mitigate the issue.
    validations:
      required: false
