"""
YouTube Bot — LiveKit Agent Server entrypoint.

Registers as agent "youtube-bot" with explicit dispatch.
Run: python main.py dev   (development) or  python main.py start  (production)
"""

import asyncio

from livekit.agents import AgentServer, JobContext, JobRequest, cli
from livekit.agents import AutoSubscribe

from agent import BOT_IDENTITY, BOT_NAME, YouTubeAgent

AGENT_NAME = "youtube-bot"

server = AgentServer(num_idle_processes=1)


async def on_request(req: JobRequest) -> None:
    await req.accept(identity=BOT_IDENTITY, name=BOT_NAME)


@server.rtc_session(agent_name=AGENT_NAME, on_request=on_request)
async def youtube_agent(ctx: JobContext) -> None:
    room = ctx.room
    shutdown_event = asyncio.Event()

    def on_shutdown() -> None:
        shutdown_event.set()

    agent = YouTubeAgent(room, on_shutdown=on_shutdown)

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    agent.setup()

    await agent.run()

    # Wait until shutdown (alone in room or leave command)
    await shutdown_event.wait()
    await agent.shutdown()
    ctx.shutdown()


if __name__ == "__main__":
    cli.run_app(server)
