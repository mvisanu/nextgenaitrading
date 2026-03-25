# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - alert [ref=e11]
  - generic [ref=e13]:
    - generic [ref=e14]:
      - img [ref=e15]
      - generic [ref=e17]: NextGenStock
    - generic [ref=e18]:
      - generic [ref=e19]:
        - heading "Sign in" [level=3] [ref=e20]
        - paragraph [ref=e21]: Enter your credentials to access your account
      - generic [ref=e23]:
        - generic [ref=e24]:
          - text: Email
          - textbox "Email" [ref=e25]:
            - /placeholder: you@example.com
        - generic [ref=e26]:
          - text: Password
          - textbox "Password" [ref=e27]
        - button "Sign in" [ref=e28] [cursor=pointer]
      - paragraph [ref=e30]:
        - text: Don't have an account?
        - link "Create one" [ref=e31] [cursor=pointer]:
          - /url: /register
    - paragraph [ref=e32]: Educational software only. Live trading carries real financial risk.
  - region "Notifications alt+T"
```