import { AppBskyActorDefs } from "@atproto/api"
import { kv } from "@vercel/kv"
import { Check, X } from "lucide-react"

import { getAgent } from "@/lib/atproto"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Profile } from "@/components/profile"
import { Stage } from "@/components/stage"

export function generateMetadata({ params }: { params: { domain: string } }) {
  const domain = params.domain
  return {
    title: `${domain} - get your community handle for Bluesky`,
    description: `get your own ${domain} handle`,
  }
}

export default async function IndexPage({
  params,
  searchParams,
}: {
  params: {
    domain: string
  }
  searchParams: {
    handle?: string
    "new-handle"?: string
  }
}) {
  const domain = params.domain
  let handle = searchParams.handle
  let newHandle = searchParams["new-handle"]
  let profile: AppBskyActorDefs.ProfileView | undefined
  let error1: string | undefined
  let error2: string | undefined

  if (handle) {
    try {
      const agent = await getAgent()
      if (!handle.includes(".")) {
        handle += ".bsky.social"
      }
      console.log("fetching profile", handle)
      const actor = await agent.getProfile({
        actor: handle,
      })
      if (!actor.success) throw new Error("fetch was not a success")
      profile = actor.data
    } catch (e) {
      console.error(e)
      error1 = (e as Error)?.message ?? "unknown error"
    }

    if (newHandle && profile) {
      newHandle = newHandle.trim().toLowerCase()
      if (!newHandle.includes(".")) {
        newHandle += "." + domain
      }
      if (!error1) {
        // regex: (alphanumeric, -, _).(domain)
        const validHandle = newHandle.match(
          new RegExp(`^[a-zA-Z0-9-_]+.${domain}$`)
        )
        if (validHandle) {
          try {
            const handle = newHandle.replace(`.${domain}`, "")
            const existing = await prisma.user.findFirst({
              where: { handle },
              include: { domain: true },
            })
            if (existing && existing.domain.name === domain) {
              if (existing.did !== profile.did) {
                error2 = "handle taken"
              }
            } else {
              await prisma.user.create({
                data: {
                  handle,
                  did: profile.did,
                  domain: {
                    connectOrCreate: {
                      where: { name: domain },
                      create: { name: domain },
                    },
                  },
                },
              })
            }
          } catch (e) {
            console.error(e)
            error2 = (e as Error)?.message ?? "unknown error"
          }
        } else {
          error2 = "invalid handle"
        }
      }
    }
  }

  return (
    <main className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
      <div className="flex max-w-[980px] flex-col items-start gap-4">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter sm:text-3xl md:text-5xl lg:text-6xl">
          블루스카이용 {domain} <br className="hidden sm:inline" />
          핸들 변경 도구
        </h1>
        <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
          다음 절차를 따라 {domain} 핸들로 변경해주세요.
        </p>
      </div>
      <div>
        <Stage title="Enter your current handle" number={1}>
          <form>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <div className="flex w-full max-w-sm items-center space-x-2">
                {newHandle && (
                  <input type="hidden" name="new-handle" value="" />
                )}
                <Input
                  type="text"
                  name="handle"
                  placeholder="example.bsky.social"
                  defaultValue={handle}
                  required
                />
                <Button type="submit">Submit</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                현재의 핸들을, @를 제외하고 입력해주세요. </p>
              {error1 && (
                <p className="flex flex-row items-center gap-2 text-sm text-red-500">
                  <X className="h-4 w-4" /> 사용자를 찾지 못했습니다. 
                </p>
              )}
              {profile && (
                <>
                  <p className="text-muted-forground mt-4 flex flex-row items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" /> 사용자를 찾았습니다. 
                  </p>
                  <Profile profile={profile} className="mt-4" />
                </>
              )}
            </div>
          </form>
        </Stage>
        <Stage title="Choose your new handle" number={2} disabled={!profile}>
          <form>
            <input type="hidden" name="handle" value={handle} />
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <div className="flex w-full max-w-sm items-center space-x-2">
                <Input
                  type="text"
                  name="new-handle"
                  placeholder={`example.${domain}`}
                  defaultValue={newHandle}
                />
                <Button type="submit">Submit</Button>
              </div>
              <p className="text-sm text-muted-foreground ">
                원하시는 {domain} 핸들을, @를 제외하고 입력해주세요. </p>
              {error2 && (
                <p className="text-sm text-red-500">
                  {(() => {
                    switch (error2) {
                      case "handle taken":
                        return "이미 데이터베이스에 등록된 핸들입니다. 실제로는 사용되고 있지 않은 핸들일 경우 관리자 (나인나인) 에게 연락해주세요."
                      case "invalid handle":
                        return "유효하지 않은 핸들입니다."
                      default:
                        return "알 수 없는 문제가 발생했습니다. 다시 시도해주세요."
                    }
                  })()}
                </p>
              )}
            </div>
          </form>
        </Stage>
        <Stage
          title="Change your handle within the Bluesky app"
          number={3}
          disabled={!newHandle || !!error2}
          last
        >
          <p className="max-w-lg text-sm">
            블루스카이 앱에서 Settings {">"} Advanced {">"} Change my handle 을 클릭합니다. &quot;I
            have my own domain&quot;를 선택하고 {" "}
            {newHandle ? `"${newHandle}"` : "새로운 핸들"}을 입력합니다. 마지막으로,
             &quot;Verify DNS Record&quot;를 클릭한 후 핸들을 업데이트합니다. </p>
          <p className="mt-6 max-w-lg text-sm">
            이 도구는 {" "}
            <a href="https://github.com/sponsors/mozzius" className="underline">
              Mozzius
            </a>에 의해 제작되었으며, 본 도메인 {domain} 은 나인나인 N1nenine 이 관리합니다.
          </p>
        </Stage>
      </div>
    </main>
  )
}
