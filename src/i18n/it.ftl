-bot-name = oliΦsbot
-bot-creator = @rayz1065
-problems-website = olifis.it
-teams-problems-website = gas.olifis.it
-problems-license-website = https://creativecommons.org/licenses/by-nc/2.0/it/
-bot-github = https://github.com/rayz1065/olifisbot/

cancel = Annulla {$emoji-cancel}
back = Indietro {$emoji-back}
back-to-menu = Torna al menù {$emoji-back}
confirm = Conferma {$emoji-confirm}
no-operation-running = Nessuna operazione in corso...
write-cancel-to-cancel-operation = Scrivi /cancel per annullare

and = e
type = Tipo
questions = Domande
question = Domanda
solution = Soluzione
answer = Risposta
date = Data
question-number = Domanda numero
questions-group = Gruppo di domande

validation-photo-required = Una foto è richiesta
validation-string-length = Invia una stringa tra {$min} e {$max} caratteri
validation-send-valid-number = Invia un numero valido
failed-to-get-question = Non sono riuscito a inviare la domanda
failed-to-send-answer = Non sono riuscito ad inviare la soluzione

admin-config = Configura Bot
olifis-config-title = Benvenut* nelle impostazioni del bot!
olifis-config-manage-editions = Gestisci edizioni
olifis-config-manage-users = Gestisci utenti
olifis-config-config = Config
olifis-config-what-edition-type-to-manage = Che edizione vuoi gestire?
olifis-config-manage-type = Gestisci tipo {$type}
olifis-config-change-type-name = Cambia nome
olifis-config-send-new-name = Invia il nuovo nome per {$type}
olifis-config-type-not-found = Tipo non trovato
olifis-config-name = Nome: {$name}
olifis-config-name-between = Invia un numero tra {$min} e {$max} caratteri
olifis-config-send-year-for-new-edition = Invia l'anno per la nuova edizione
olifis-config-create-edition = Crea nuova edizione
olifis-config-create-edition-for = Crea edizione per {$type}
olifis-config-send-a-valid-year = Invia un anno valido
olifis-config-send-date = Invia la data dell'edizione in formato YYYY-MM-DD o sceglila dal calendario
olifis-config-year = Anno
olifis-config-is-date = La data della competizione è {$date}?
olifis-config-invalid-date = La data inserita non è valida
olifis-config-confirm-creation = Confermi creazione?
olifis-config-manage-edition = Gestisci edizione dell'anno {NUMBER($year, useGrouping: 0)}
olifis-config-edition-not-found = Edizione non trovata
olifis-config-edition-already-exists = Questa edizione esiste già
olifis-config-send-new-date = Invia la nuova data
olifis-config-change-date = Cambia data
olifis-config-create-question-group = Crea gruppo di domande
olifis-config-send-question-image = Invia la nuova immagine per la domanda
olifis-config-creating-question-for = Creazione di una domanda per l'edizione {NUMBER($year, useGrouping: 0)}
olifis-config-send-solution-image = Invia l'immagine per la soluzione
olifis-config-send-questions-group-title = Invia il nuovo titolo per il gruppo di domande
olifis-config-create-question = Crea domanda
olifis-config-questions-group-not-found = Gruppo di domande non trovato
olifis-config-change-group-title = Cambia titolo del gruppo di domande
olifis-config-open-answer = Risposta aperta
olifis-config-choose-answer-or-type =
    Scegli una delle risposte o invia una risposta aperta in uno dei seguenti formati:
    ➡️ &lt;min&gt; &lt;max&gt; [&lt;unità&gt], e.g.: "9.6 10 m/s^2", "99 101"
    ➡️ &lt;valore&gt; &lt;errore&gt% [&lt;unità&gt;], "50 1% km^2", "1000 5%".

    Invia una riga che inizia con '<code>=</code>' se le soluzione è una formula, e.g. "= G*M*m / (r^2)"
# Invia una riga che inizia con '<code>?</code>' se la soluzione è da scegliere tra delle opzioni, e.g. "?Stabile,Instabile" o "? α &lt; 0, α ≥ 0"
olifis-config-question-created = La domanda è stata creata

adimensional = Adimensionale
invalid-answer = Questa risposta non è valida
invalid-open-answer-format = Formato non valido, indica due numeri e un'unità di misura
invalid-error = Errore inserito non valido
with-variables = con variabili
parse-error = Errore nel leggere la formula

welcome-to-olifis-bot = Benvenut* {$user-name} in {-bot-name}!
no-random-question-found = Non ho trovato una domanda casuale!
main-menu = Menù principale
random-question = Domanda casuale
question-not-found = Domanda non trovata!
wrong-answer-type = Tipo di risposta sbagliato
the-solution-is = La risposta è { $answer }
you-solved-in-attempts =
    {
        $attempts ->
        [one] Hai risolto questa domanda al primo colpo
        *[other] Hai risolto la domanda dopo { $attempts } tentativi
    }
is-not-the-right-answer = {$answer} non è la risposta corretta
you-saw-the-solution = Hai visto la soluzione
show-solution = Mostra soluzione
hide-solution = Nascondi soluzione
attempt-answer = Prova a rispondere
attempt-answer-formula-explanation =
    Rispondi con una formula contenente le variabili { $variables }, premine una per copiarla.
    Esplicita sempre tutte le operazioni, usa le parentesi in caso di dubbio.
attempt-answer-open-explanation =
    Manda come risposta solo un solo numero, la soluzione in [{ $unit }]

choose-an-edition-to-see-questions = Scegli una delle edizioni per vedere la lista delle domande
choose-a-question-from-the-list = Scegli una delle domande tra quelle disponibili
choose-a-topic = Scegli un argomento dalla lista
questions-with-tag = Domande con tag { $tag }

contact-me = Contattami
editions = Edizioni
info = Info
stats = Statistiche
search-by-topic = Cerca per argomento
competition-date = Data gara
archive-url = Url archivio
config = Impostazioni

choose-your-config = Scegli le tue impostazioni per il bot

your-profile-on-bot = Il tuo profilo su {-bot-name}
profile = Profilo
name = Nome
username = Username
subscription-date = Data iscrizione
solved-questions = Quesiti risolti
attempts-average = Tentativi in media
total-attempted = Totale provati
solutions-seen = Soluzioni viste
friends-invited = Amici invitati
attempted-questions = Domande provate

formatted-date-short = {DATETIME($date, month: "short", year: "numeric", day: "numeric")}
formatted-date-long = {DATETIME($date, month: "long", year: "numeric", day: "numeric", weekday: "long")}

bot-info-msg =
    📖 <b>Informazioni su {-bot-name}</b>
    👨‍💻 Questo bot è stato creato da {-bot-creator}.

    🔗 I problemi delle <i>olimpiadi di fisica</i> possono essere trovati online sul sito {-problems-website}.
    🧲 I problemi dei <i>campionati a squadre</i> si possono trovare su {-teams-problems-website}.

    📃 Tutti i problemi sono disponibili sotto <b>licenza</b> CC BY-NC, ne puoi scaricare una copia su {-problems-license-website}.

    📦 Il <b>codice sorgente</b> di {-bot-name} si trova su GitHub a {-bot-github}.

welcome-msg =
    Benvenut* {$user-name} su <b>{-bot-name}</b>, bot non ufficiale per allenarti per le olimpiadi di fisica!

    ❓ Con questo bot potrai trovare i quesiti e le risposte delle varie gare delle olimpiadi di fisica.
    🎲 Puoi iniziare da un quesito casuale
    📰 Cercare quello che ti interessa tra le varie edizioni passate
    ⚛️ O cercarne uno in base all'argomento

    🆘 Se hai problemi con il bot, hai trovato un errore, vuoi aiutarmi a taggare i problemi o lasciarmi del feedback, sentiti liber* di contattarmi!

info-and-stats = Informazioni e statistiche su {-bot-name}
bot-created-on = Bot creato il
subscribed-users = Numero di utenti iscritti
questions-count = Numero di quesiti

join-bot =
    Entra in <b>{-bot-name}</b>, bot telegram per i problemi delle olimpiadi di fisica. Mille quesiti aspettano soltanto te!
enter-bot = Entra nel bot
