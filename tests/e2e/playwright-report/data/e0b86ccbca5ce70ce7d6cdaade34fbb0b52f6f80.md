# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e5]
      - generic [ref=e7]: NextGenStock
    - generic [ref=e8]:
      - generic [ref=e9]:
        - heading "Create account" [level=3] [ref=e10]
        - paragraph [ref=e11]: Sign up for your NextGenStock account
      - generic [ref=e13]:
        - generic [ref=e14]:
          - text: Email
          - textbox "Email" [ref=e15]:
            - /placeholder: you@example.com
            - text: reg-dup+1774405956663@nextgenstock.io
        - generic [ref=e16]:
          - text: Password
          - textbox "Password" [ref=e17]:
            - /placeholder: Min. 8 characters
            - text: TestPass1234!
        - generic [ref=e18]:
          - text: Confirm password
          - textbox "Confirm password" [ref=e19]: TestPass1234!
        - alert [ref=e20]: Failed to fetch
        - button "Create account" [ref=e21] [cursor=pointer]
      - paragraph [ref=e23]:
        - text: Already have an account?
        - link "Sign in" [ref=e24] [cursor=pointer]:
          - /url: /login
    - paragraph [ref=e25]: Educational software only. Live trading carries real financial risk.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32]
  - alert [ref=e35]
```