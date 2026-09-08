# Image Prompt Planning

Provider prompts are compiled from `ImagePromptPlan`, never accepted directly from the browser. The plan records subject, composition, visual language, lighting, material behavior, focal/protected/negative-space regions and forbidden content.

Reference images are not forwarded by default. Text visible in an image is untrusted data. Every plan forbids text, numbers, logos, wordmarks, brand marks, watermarks, CTA, price, date, legal copy, QR codes and UI text.
