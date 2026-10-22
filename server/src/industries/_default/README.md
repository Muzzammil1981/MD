# Industry folders

Each business type has its own folder:

    industries/
      _default/rules.js        rules every industry starts from (read this first)
      mehndi/    profile.js    wording + starter categories
                 rules.js      ONLY the rules that differ from _default
      barber/ ...  salon/ ...  carwash/ ...
      _template/               copy this folder to start a new industry

* profile.js  - the words customers read (name, "service"/"design", hero text ...) and starter categories.
* rules.js    - how the business works (slots or tokens, deposits, extra booking questions, special checks).

Industries you add from the SuperAdmin screen (no code) copy a built-in one and store their wording in the
database. Give them code rules by creating a folder here with the same key.
