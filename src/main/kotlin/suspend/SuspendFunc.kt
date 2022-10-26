package suspend

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.coroutines.*

private val scheduler = Executors.newScheduledThreadPool(1) {
    Thread(it).apply { isDaemon = true }
}

suspend fun main(): Unit = coroutineScope {
    flow {
        emit(1)
    }
}

suspend fun test() = suspendCoroutine {
    scheduler.schedule({ it.resumeWith(Result.success("Hello World")) }, 1, TimeUnit.SECONDS)
}