package team.redrock.rain

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

fun main() {
    val executorService = Executors.newScheduledThreadPool(1)
    executorService.schedule({
        println("战争即和平")
    }, 1, TimeUnit.SECONDS)
    val scheduledFuture = executorService.schedule({
        println("自由即奴役")
    }, 2, TimeUnit.SECONDS)
    executorService.scheduleWithFixedDelay({
        println("无知即力量")
    }, 2, 1, TimeUnit.SECONDS)
    Thread.sleep(1000)
    scheduledFuture.cancel(true)
    Thread.sleep(5000)
    executorService.shutdown()
}