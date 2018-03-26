# StackBot

A chat bot to help you find the best tool for your next project.

## Capabilities

Currently, you can ask StackBot things like "Which message queue should I use?" or "What's the most popular web cache tool?".

StackBot will respond with the most popular tool on StackShare along with some helpful information.

## Limitations

StackBot uses slugify to transform the matched entity for lookup in the database (transactional email > transactional-email). Some tools are typically spoken of in the singular form, but stored in the database in the plural form: "What's the best business dashboard tool?" is stored as "business-dashboards" and will not return a match. Other issues in matching could be things like "content delivery network", which is stored as "cdn".

Beyond that, the bot just needs more training. At the time of writing, I've entered about 30 training phrases, and it often still has difficulty matching the tool type for tools I have not explicitly mentioned in them.

StackBot is also pretty one-dimensional. She's not much of a conversationalist yet.

## Future Improvements

The future of StackBot is a much richer, conversational experience. A user should be able to get recommendations for tools based on their current stack (graph database? ML?). The bot should be able to respond to queries based on the context of the current conversation.

## Demo

You can try the demo [here](https://bot.dialogflow.com/5d45cb97-0956-4cef-b6a4-80ddc5cd8240).
