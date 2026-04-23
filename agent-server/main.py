"""
Bot entrypoint — registers as "youtube-bot" with explicit dispatch.

Run: python main.py dev   (development)
     python main.py start  (production)
"""

import asyncio
import os

from livekit.agents import AgentServer, JobContext, JobRequest, cli
from livekit.agents import AutoSubscribe

from src.bot import Bot
from src.config import AGENT_NAME, BOT_IDENTITY, BOT_NAME, LIVEKIT_URL
from src.llm import OpenRouterProvider
from src.memory import MemoryStore

os.environ["LIVEKIT_URL"] = LIVEKIT_URL
server = AgentServer(num_idle_processes=1)

# Shared ephemeral memory store (lives only while bot is in the room)
memory = MemoryStore()


async def on_request(req: JobRequest) -> None:
    await req.accept(identity=BOT_IDENTITY, name=BOT_NAME)


@server.rtc_session(agent_name=AGENT_NAME, on_request=on_request)
async def bot_session(ctx: JobContext) -> None:
    room = ctx.room
    shutdown_event = asyncio.Event()

    # Optional: add OPENROUTER_API_KEY env var to enable AI features
    llm = OpenRouterProvider() if os.getenv("OPENROUTER_API_KEY") else None
    bot = Bot(room, on_shutdown=shutdown_event.set, llm=llm, memory=memory)

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    bot.setup()

    await bot.run()

    await shutdown_event.wait()
    await bot.shutdown()
    ctx.shutdown()


if __name__ == "__main__":
    cli.run_app(server)
