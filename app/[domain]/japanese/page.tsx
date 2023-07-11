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
          Bluesky用の{domain} <br className="hidden sm:inline" />
          ハンドル取得ツール
        </h1>
        <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
          {domain} ハンドルに変更するには、以下に従って操作してください。
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
                現在のハンドルを入力してください（@は除く）。 </p>
              {error1 && (
                <p className="flex flex-row items-center gap-2 text-sm text-red-500">
                  <X className="h-4 w-4" /> ユーザーが見つかりませんでした。
                </p>
              )}
              {profile && (
                <>
                  <p className="text-muted-forground mt-4 flex flex-row items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" /> ユーザーが見つかりました。
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
                取得希望の {domain} ハンドルを入力してください（@は除く）。 </p>
              {error2 && (
                <p className="text-sm text-red-500">
                  {(() => {
                    switch (error2) {
                      case "handle taken":
                        return "すでに使われているハンドルです。"
                      case "invalid handle":
                        return "ハンドルが無効です。"
                      default:
                        return "エラーが発生しました。もう一度操作してください。"
                    }
                  })()}
                </p>
              )}
            </div>
          </form>
        </Stage>
        <Stage
          title="Blueskyアプリでハンドルを変更する"
          number={3}
          disabled={!newHandle || !!error2}
          last
        >
          <p className="max-w-lg text-sm">
            BlueskyアプリでSettings {">"} Advanced {">"} Change my handle を選択します。&quot;I
            have my own domain&quot;を選び、{" "}
            {newHandle ? `"${newHandle}"` : "新しいハンドル"}を入力します。
             &quot;Verify DNS Record&quot;をクリックし、ハンドルをアップデートします。</p>

          <p className="mt-6 max-w-lg text-sm">
            このツールは {" "}
            <a href="https://github.com/sponsors/mozzius" className="underline">
              Mozzius
            </a>に作られ、配布されています。本ドメイン {domain} はN1nenineに管理されています。
          </p>
        </Stage>
      </div>
    </main>
  )
}
