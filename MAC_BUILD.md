# Mac build without giving code to anyone

TextNexus Mac `.dmg` **Windows PC pe nahi banti**. Dost ko code dena bhi zaroori nahi.

## Best way: Private GitHub + Actions (code secret rehta hai)

GitHub ka **macOS cloud computer** tumhara code temporarily build karta hai.  
Dost / outsider ko access nahi milta — sirf **private repo** ke owners.

### Step 1 — Private repo banao
1. [github.com/new](https://github.com/new) kholo  
2. Repo name: `textnexus-app` (jo chaho)  
3. Visibility: **Private** (zaroor)  
4. Create repository

### Step 2 — Code push karo (GitHub Desktop se aasan)
1. **GitHub Desktop** open karo  
2. File → Add Local Repository → `franz-clone` folder  
   - Agar “not a git repository” aaye → *create a repository* / publish  
3. Commit message: `Add macOS CI build`  
4. **Publish repository** → tick **Keep this code private**  
5. Push

Ya terminal se (agar git PATH pe ho):

```bash
cd franz-clone
git init
git add .
git commit -m "Add macOS CI build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_PRIVATE_REPO.git
git push -u origin main
```

### Step 3 — Mac build chalao
1. GitHub pe apni **private** repo kholo  
2. **Actions** tab  
3. Left: **Build macOS**  
4. **Run workflow** → Run  
5. 20–60 min wait (pehli baar zyada)

### Step 4 — DMG download
1. Green ✓ run pe click  
2. Neeche **Artifacts** → `textnexus-macos`  
3. Download → unzip → milenge:
   - `TextNexus-*-mac-arm64.dmg` (M1/M2/M3 Mac)
   - `TextNexus-*-mac-x64.dmg` (Intel Mac)

Yeh files GitHub Release / `textnexus-releases` pe daal sakte ho — **source code nahi**.

---

## Important
| Cheez | Detail |
|--------|--------|
| Code share? | **Nahi** — private repo + sirf tum login |
| Dost ko kya dena? | Sirf `.dmg` (optional), code nahi |
| Cost | Private repo pe free minutes limited; macOS minutes zyada count hoti hain |
| Gatekeeper | Unsigned DMG pe Mac pe “unidentified developer” aa sakta hai → Right‑click → Open |

## Apple signing (baad mein, optional)
App Store / smooth Gatekeeper ke liye Apple Developer account (~$99/year) chahiye. Abhi bina sign ke DMG chal jayegi (Open se).

## Alternative (bina GitHub)
MacinCloud / MacStadium jaisa **khud ka rented Mac** rent karo, wahan `npm run build-mac` — phir bhi dost ko code nahi.
