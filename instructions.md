# Background and general info
A few years ago I built a "guessing game" online for the nobel prize week (coming up soon, week 41) where people could pick a lot of different outcomes. As the nobel prize is a bit above most of us, I checked some motivation texts from the last 20 years, which affiliation the laureates in the three science + economics had (MIT, Johns Hopkins etc) and calculated probabilties (so picking a winner from MIT would give you an odds of 1.7 or so, as it's rather common.)
I also had a number pick of female laureates and such. For some of the science prizes I had picked phrases to occur in the short motivation, like "for the discovery" and also had a pick of 1,2 or 3 laureates per price. For the literature prize I had "prose, poetry or other" as the main field for the laureate.
So a player gave about 2 answers per prize, plus the total number of females and I guess there also were some odd questions like "will there be a laureate currently living in africa?" and "How many american citizens?".

If I remember correctly, a question about how many laureates for a certain prize could have the data from the 20 previous years: 1 laureate 4/20 times, 2 laureates 6/20 times and the rest of the times (10) there were 3 laureates. A player guessing 1 laureate correctly would then have been awarded with 5 points = (1 / (4/20))

Some of the questions must be asked before the first prize is announced, some can be asked before that actual prize.

All nobel prize categories should be included in the game.

Every question has a enddate and -time when it must be submitted. Some of the questions are about the whole week, and should have the same enddate and -time as the first prize (physics)

Data for all questions could be found in `nobeldata.md`. For all other info, use the official nobel prize site. All prize info should be collected from that site and the game should be able to do so starting five minutes after the announcement time, and then regularly retry if not found. The info about this years laureates, prize motivation etc could be found on different urls, so build the game to be prepared for that.

## Users
A user must register by email, password and verification email.

At login, a user should see the "guesstimate" form or todays question, their answer and a countdown timer if before the prize is announced. After the game has collected the announcment the user should see the correct answers, his/her answer, todays points, total points, their place in the competition and a top-ten list of users (ranked pointwise).

A user should never see more than the username, total points and todays points of other users.

A user should be able to change prize specific questions in the middle of the game, if the prize hasn't been announced yet.

There should be GDPR info about why the game store the email adresses.

## Pages

The user should experience a login page, after succesful login a single page displaying the questionaire/their answers, a table of the top ten users and info about todays prize.

A day after the final prize is announced, only the total list of players should be displayed, ranked by points. Also, a short note to check back in a year. A logged in user at that time should see their points, answers and correct results.

## Design

Science and nobel prize can be rather stiff or noble (pun intended), but I want a cheery, flowery theme. Warm colors, playful fonts and style. As usual though, we want to have high accessibility.

## Quiz/guesstimate/questions

For each day/prize, create at least two, maybe three questions. 
For the whole week, create some questions that has that scope ("How many female laureates?", "Will the average age of all laureates be more than 72?") and so on.
Questions should have no more than four, maybe five alternative answers.
Build an automatic control so that the game can collect some text from the nobelprize site and decide which of the answers that are fulfilled.

In the unlikely eevent that none of the answers are correct (maybe no prize was awarded?), all users still get 1 point that day.