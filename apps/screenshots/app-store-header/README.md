# App Store header and search art

iOS 27 product page header (3840x1646) and search results asset (3840x2560). `f-ledger.html` ray-traces the scene in WebGL2; every knob is a URL parameter. Run from this folder with Chrome installed:

```sh
# Product page header
./render.sh "f-ledger.html?obj=none&tl=row&wl=1&spp=9&tth=0.05&tsk=6&tsc=0.88&w=3840&h=1646" 3840 1646 header-en.png
./render.sh "f-ledger.html?obj=none&tl=row&wl=1&spp=9&tth=0.05&tsk=6&tsc=0.88&lang=es&w=3840&h=1646" 3840 1646 header-es.png

# Search results
./render.sh "f-ledger.html?obj=none&tl=search&wl=1&screen=en/05&tsc=0.82&spp=9&tth=0.05&tsk=6&w=3840&h=2560" 3840 2560 search-en.png
./render.sh "f-ledger.html?obj=none&tl=search&wl=1&screen=es/05&lang=es&tsc=0.82&spp=9&tth=0.05&tsk=6&w=3840&h=2560" 3840 2560 search-es.png
```

`w` and `h` must match the window size. `lang=es` swaps the widget copy and the ledger to the app's Spanish strings and peso amounts. Keep third-party names out: the Log, Accounts and Upcoming screenshots show bank and merchant logos, so the phone uses Insights (`05`).
