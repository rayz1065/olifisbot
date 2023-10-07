-bot-name = oliΦsbot
-bot-creator = @rayz1065
-problems-website = olifis.it
-news-channel = @olifisnews
-teams-problems-website = gas.olifis.it
-problems-license-website = https://creativecommons.org/licenses/by-nc/2.0/
-bot-github = https://github.com/rayz1065/olifisbot/

# base

-emoji-cancel = ❌
-emoji-back = 🔙
-emoji-confirm = ✅
cancel = Cancel {-emoji-cancel}
back = Back {-emoji-back}
back-to-menu = Back to menu {-emoji-back}
confirm = Confirm {-emoji-confirm}
no-operation-running = No operation is running...
write-cancel-to-cancel-operation = Write /cancel to cancel operation

# bot names and descriptions
bot-name = Physics Olympiads ⚛️
bot-short-description = Navigate through the problems from the physics Olympiads!
    🧑‍💻 Dev: {-bot-creator}
    📢 {-news-channel}
bot-description =
    Navigate through the problems from the physics Olympiads of every level, more than a thousand problems are waiting for you!
    🎲 Solve a random question
    🔥 Search based on topic
    📰 Access to all the old editions
    👤 Keep track of your progress

    👨‍💻 Dev: {-bot-creator}
    📢 News: {-news-channel}
    📦 GitHub: {-bot-github}
    📃 The problems are available on their respective websites and released under license CC-BY-NC

bot-info-msg =
    📖 <b>Information about {-bot-name}</b>
    👨‍💻 This bot was created by {-bot-creator}.
    📢 News: {-news-channel}

    🔗 Problems from <i>physics Olympiads</i> can be found online on the website {-problems-website}.
    🧲 Problems of the <i>teams championship</i> can be found on {-teams-problems-website}.

    📃 All problems are available under the <b>license</b> CC BY-NC, download a copy of it on {-problems-license-website}.

    📦 The <b>source code</b> of {-bot-name} is on GitHub at {-bot-github}.
    🛠 Written in Typescript with the framework <a href="https://grammy.dev/">grammy</a>
start-cmd-help = Start the bot

# spash messages

join-news-channel = 📢 Join {-news-channel} for all the news
view-source-code = 📦 The source code is available on {-bot-github}
bot-completely-rewritten = 👨‍💻 The bot has been rewritten entirely, leave me a feedback {-bot-creator}
now-with-more-championships = 🧲 Contains 400% more championships
contains-problems-count = 📖 There are currently <b>{$problemsCount}</b> problems
write-start-to-open-menu = Write /start to open the main menu

and = And
type = Type
questions = Questions
question = Question
solution = Solution
answer = Answer
date = Date
question-number = Question number
questions-group = Questions group

validation-photo-required = A photo is required
validation-string-length = Send a string between {$min} and {$max} characters
validation-send-valid-number = Send a valid number
failed-to-get-question = Failed to get the question
failed-to-send-answer = Failed to send the answer

admin-config = Manage Bot
olifis-config-title = Welcome to olifis config
olifis-config-manage-editions = Manage Editions
olifis-config-manage-users = Manage Users
olifis-config-config = Config
olifis-config-what-edition-type-to-manage = What edition type do you want to manage?
olifis-config-manage-type = Manage type {$type}
olifis-config-change-type-name = Change name
olifis-config-send-new-name = Send the new name for {$type}
olifis-config-type-not-found = Type not found
olifis-config-name = Name: {$name}
olifis-config-name-between = Please send a name between {$min} and {$max} characters
olifis-config-send-year-for-new-edition = Send the year for the new edition
olifis-config-create-edition = Create new edition
olifis-config-create-edition-for = Create edition for {$type}
olifis-config-send-a-valid-year = Send a valid year
olifis-config-send-date = Send the date of the competition in the format YYYY-MM-DD or pick one from the calendar
olifis-config-year = Year
olifis-config-is-date = Is the date of the competition {$date}?
olifis-config-invalid-date = The inserted date is invalid
olifis-config-confirm-creation = Confirm creation?
olifis-config-manage-edition = Manage edition of year {NUMBER($year, useGrouping: 0)}
olifis-config-edition-not-found = Edition not found
olifis-config-edition-already-exists = This edition already exists
olifis-config-send-new-date = Send the new date
olifis-config-change-date = Change date
olifis-config-create-question-group = Create question group
olifis-config-send-question-image = Send the image for the question
olifis-config-creating-question-for = Creating a question for edition {NUMBER($year, useGrouping: 0)}
olifis-config-send-solution-image = Send the image for the solution
olifis-config-send-questions-group-title = Send the title for the question group
olifis-config-create-question = Create question
olifis-config-questions-group-not-found = Questions group not found
olifis-config-change-group-title = Change group title
olifis-config-open-answer = Open answer
olifis-config-choose-answer-or-type =
    <b>Closed answer</b>: choose between the available ones
    <b>Open answer</b>: write the answer in one of the following formats,
    ➡️ <code>&lt;min&gt; &lt;max&gt; [&lt;unit&gt]</code>, e.g.: "<code>9.6 10 m/s^2</code>", "<code>99 101</code>";
    ➡️ <code>&lt;value&gt; &lt;error&gt% [&lt;unit&gt;]</code>, "<code>50 1% km^2</code>", "<code>1000 5%</code>".

    <b>Formula</b>: send a line starting with '<code>=</code>', e.g. "<code>= G*M*m / (r^2)</code>"
    🖼 <b>Self evaluation</b> send an image if the solution is of type self evaluation
olifis-config-question-created = The question was created

adimensional = Adimensional
invalid-answer = This answer is not valid
invalid-open-answer-format = Format not valid, please two numbers and a unit
invalid-error = Indicated error not valid
with-variables = with variables
parse-error = Error reading the formula
self-evaluation = Self evaluation

welcome-to-olifis-bot = Welcome {$user-name} to {-bot-name}!
no-random-question-found = No random question found!
main-menu = Main menu
random-question = Random question
question-not-found = Question not found!
wrong-answer-type = Wrong answer type
the-solution-is = The solution is { $answer }
you-solved-in-attempts =
    {
        $attempts ->
        [one] You solved the question on the first try
        *[other] You solved the question in { $attempts } attempts
    }
is-not-the-right-answer = {$answer} is not the right answer
you-saw-the-solution = You saw the solution
show-solution = Show solution
hide-solution = Hide solution
attempt-answer = Try replying
attempt-answer-formula-explanation =
    Reply with a formula containing the variables { $variables }, press one of them to copy it.
    Always explicit all the operations, use parenthesis when in doubt.
attempt-answer-open-explanation =
    Send as reply just one number, the solution in [{ $unit }]
self-evaluate = Self evaluate ✏️
attempt-answer-evaluation-explanation =
    Check if your answer corresponds to the image
    <i>If your answer is wrong and you want to keep track of your progress, press {add-error}</i>
mark-solved = Question solved ✅
add-error = Add error 😞
error-added = Error added ❌

choose-an-edition-to-see-questions = Choose one of the editions to get the list of the questions
choose-a-question-from-the-list = Choose one of the questions from the ones available
choose-a-topic = Choose a topic from the list
questions-with-tag = Questions with tag { $tag }

contact-me = Contact me
editions = Editions
info = Info
stats = Stats
search-by-topic = Search by topic
competition-date = Competition date
archive-url = Archive url
config = Config

choose-your-config = Change the bot configuration

your-profile-on-bot = Your profile on {-bot-name}
profile = Profile
name = Name
username = Username
subscription-date = Subscription date
solved-questions = Questions solved
attempts-average = Attempts on average
total-attempted = Total attempted
solutions-seen = Solutions seen
friends-invited = Friends invited
attempted-questions = Attempted questions

formatted-date-short = {DATETIME($date, month: "short", year: "numeric", day: "numeric")}
formatted-date-long = {DATETIME($date, month: "long", year: "numeric", day: "numeric", weekday: "long")}

welcome-msg =
    Welcome {$user-name} on <b>{-bot-name}</b>, unofficial bot to train for the physics Olympiads!

    ❓ With this bot you can find the questions and answers to various competitions of the physics Olympiads.
    🎲 You can start with a random question
    📰 Find what you're interested in from the previous editions
    ⚛️ Or search based on the topic

    🆘 If you're having issues with the bot, have found an error, want to help me tag the questions, or want to leave me some feedback, feel free to contact me!

info-and-stats = Infos and stats about {-bot-name}
bot-created-on = Bot created on
subscribed-users = Total subscribed users
questions-count = Total questions

join-bot =
    Join <b>{-bot-name}</b>, telegram bot for the physics Olympiads problems. A thousand questions are waiting just for you!
enter-bot = Join bot
