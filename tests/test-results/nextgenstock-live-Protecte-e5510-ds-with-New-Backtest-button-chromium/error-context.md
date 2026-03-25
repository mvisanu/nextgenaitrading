# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e5]
      - generic [ref=e7]: NextGenStock
    - generic [ref=e8]:
      - generic [ref=e9]:
        - heading "Sign in" [level=3] [ref=e10]
        - paragraph [ref=e11]: Enter your credentials to access your account
      - generic [ref=e13]:
        - generic [ref=e14]:
          - text: Email
          - textbox "Email" [ref=e15]:
            - /placeholder: you@example.com
            - text: pages+1774405300043@nextgenstock.io
        - generic [ref=e16]:
          - text: Password
          - textbox "Password" [ref=e17]: TestPass1234!
        - alert [ref=e18]: Failed to fetch
        - button "Sign in" [ref=e19] [cursor=pointer]
      - paragraph [ref=e21]:
        - text: Don't have an account?
        - link "Create one" [ref=e22] [cursor=pointer]:
          - /url: /register
    - paragraph [ref=e23]: Educational software only. Live trading carries real financial risk.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e29] [cursor=pointer]:
    - img [ref=e30]
  - alert [ref=e33]
```